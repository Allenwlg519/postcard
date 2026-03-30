/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, Component } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { X, MapPin, Calendar, Edit3, Save, ArrowLeft, Plus, Image as ImageIcon, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc,
  query, 
  orderBy, 
  serverTimestamp,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    // @ts-ignore
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    // @ts-ignore
    const state = this.state;
    // @ts-ignore
    const props = this.props;
    if (state.hasError) {
      let message = "Something went wrong.";
      try {
        const parsed = JSON.parse(state.error.message);
        if (parsed.error) message = `Database Error: ${parsed.error}`;
      } catch (e) {
        message = state.error.message || message;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f2ed] p-8">
          <div className="bg-white p-8 shadow-xl border border-[#5A5A40]/20 max-w-md w-full text-center">
            <h2 className="font-serif text-2xl text-[#5A5A40] mb-4">竹林连接错误</h2>
            <p className="text-sm text-[#5A5A40]/60 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#5A5A40] text-white text-xs uppercase tracking-widest font-medium rounded-sm"
            >
              刷新竹林
            </button>
          </div>
        </div>
      );
    }
    return props.children;
  }
}

interface PostcardData {
  id: string;
  title: string;
  location: string;
  date: string;
  content: string;
  backContent: string;
  image: string;
  rotation: number;
  x: number;
  y: number;
  lastEditedBy?: string;
  lastEditedByUid?: string;
}

const INITIAL_POSTCARDS = [
  {
    title: "Swiss Alps Reflection",
    location: "Zermatt, Switzerland",
    date: "May 12, 2024",
    content: "The Matterhorn reflected perfectly in the still waters of Riffelsee. The air is so crisp and the silence is absolute. A true mountain paradise.",
    backContent: "The air here is so fresh! I wish you could see this peak in person. Love, Allen.",
    image: "https://picsum.photos/seed/alps/600/800",
    rotation: -5,
    x: 15,
    y: 10,
  },
  {
    title: "Santorini Sunset",
    location: "Oia, Greece",
    date: "June 05, 2024",
    content: "Watching the sun dip below the Aegean Sea from the white-washed cliffs of Oia. The sky turned into a canvas of pink and gold. Simply magical.",
    backContent: "The sunsets here are even better than the photos. Positano next! Cheers, Allen.",
    image: "https://picsum.photos/seed/santorini/600/800",
    rotation: 8,
    x: 65,
    y: 15,
  },
  {
    title: "Kyoto Bamboo Forest",
    location: "Arashiyama, Japan",
    date: "April 22, 2024",
    content: "The towering bamboo stalks sway gently in the breeze, creating a rhythmic rustling sound. It feels like walking through a living emerald cathedral.",
    backContent: "Kyoto is so peaceful. The gardens are a work of art. See you soon! Allen.",
    image: "https://picsum.photos/seed/kyoto/600/800",
    rotation: -3,
    x: 40,
    y: 45,
  },
  {
    title: "Grand Canyon Vista",
    location: "Arizona, USA",
    date: "March 15, 2024",
    content: "Standing at Mather Point, the sheer scale of the canyon is overwhelming. The layers of red rock tell a story of millions of years of history.",
    backContent: "The Grand Canyon is massive! Photos don't do it justice. Best, Allen.",
    image: "https://picsum.photos/seed/grandcanyon/600/800",
    rotation: 12,
    x: 10,
    y: 60,
  },
  {
    title: "Icelandic Aurora",
    location: "Reykjavik, Iceland",
    date: "February 02, 2024",
    content: "The Northern Lights danced across the Arctic sky tonight. Green ribbons of light swirling above the snow-covered volcanic landscape. Unforgettable.",
    backContent: "I finally saw the Aurora! It was like magic in the sky. Cold but worth it! Allen.",
    image: "https://picsum.photos/seed/aurora/600/800",
    rotation: -10,
    x: 75,
    y: 55,
  },
  {
    title: "Bali Rice Terraces",
    location: "Ubud, Indonesia",
    date: "July 18, 2024",
    content: "The Tegallalang rice terraces are a masterpiece of traditional Balinese irrigation. Every shade of green imaginable under the tropical sun.",
    backContent: "The green here is so intense! Bali is amazing. Miss you all! Allen.",
    image: "https://picsum.photos/seed/bali/600/800",
    rotation: 5,
    x: 30,
    y: 80,
  },
  {
    title: "Amalfi Coast View",
    location: "Positano, Italy",
    date: "August 10, 2024",
    content: "Colorful houses cascading down the cliffs towards the turquoise Mediterranean. The scent of lemons and sea salt fills the air.",
    backContent: "Eating pasta with a view of the sea. Positano is a dream. Love, Allen.",
    image: "https://picsum.photos/seed/amalfi/600/800",
    rotation: -7,
    x: 50,
    y: 20,
  },
  {
    title: "Norwegian Fjords",
    location: "Geiranger, Norway",
    date: "September 05, 2024",
    content: "Deep blue waters surrounded by towering snow-capped peaks. Nature at its most majestic and untouched.",
    backContent: "The fjords are breathtaking. So quiet and grand. Best, Allen.",
    image: "https://picsum.photos/seed/norway/600/800",
    rotation: 4,
    x: 10,
    y: 70,
  },
  {
    title: "Provence Lavender",
    location: "Valensole, France",
    date: "July 02, 2024",
    content: "Endless rows of purple lavender stretching towards the horizon. The fragrance is intoxicating and the color is surreal.",
    backContent: "The lavender fields smell incredible! Provence is lovely. See you, Allen.",
    image: "https://picsum.photos/seed/provence/600/800",
    rotation: -2,
    x: 80,
    y: 40,
  }
];

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

interface PostcardItemProps {
  key?: string;
  postcard: PostcardData;
  index: number;
  onSelect: () => void;
}

function PostcardItem({ postcard, index, onSelect }: PostcardItemProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const x = useMotionValue(0);
  // Map drag x to a temporary rotation delta
  const dragRotation = useTransform(x, [-200, 200], [-180, 180]);
  
  return (
    <motion.div
      layoutId={`postcard-${postcard.id}`}
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: index * 0.1 }}
      className="relative cursor-grab active:cursor-grabbing"
      style={{
        width: '320px',
        height: '440px',
        perspective: '1000px',
      }}
    >
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        style={{ 
          x, 
          rotateY: useTransform(dragRotation, (v) => v + (isFlipped ? 180 : 0)),
          transformStyle: 'preserve-3d',
          width: '100%',
          height: '100%'
        }}
        onDragEnd={() => {
          const currentDragRotate = dragRotation.get();
          if (Math.abs(currentDragRotate) > 90) {
            setIsFlipped(!isFlipped);
          }
          x.set(0);
        }}
        onClick={() => {
          if (Math.abs(x.get()) < 5) {
            onSelect();
          }
        }}
      >
        {/* Front Side */}
        <div 
          className="absolute inset-0 bg-white p-6 pb-20 shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-black/5"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="overflow-hidden aspect-[3/4] w-full h-full bg-[#f8f5f0] relative">
            <img 
              src={postcard.image} 
              alt={postcard.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-40" />
          </div>
          <div className="absolute bottom-6 left-6 right-6">
            <h3 className="font-serif italic text-xl text-[#5A5A40] truncate leading-tight">{postcard.title}</h3>
            <div className="flex justify-between items-center mt-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#5A5A40]/60 flex items-center gap-2 font-bold">
                <MapPin size={12} /> {postcard.location}
              </p>
              <span className="w-8 h-[1px] bg-[#5A5A40]/20" />
            </div>
          </div>
        </div>

        {/* Back Side */}
        <div 
          className="absolute inset-0 bg-[#fdfcf9] p-10 border border-black/5 flex flex-col items-center justify-center text-center shadow-[0_20px_40px_rgba(0,0,0,0.2)]"
          style={{ 
            transform: 'rotateY(180deg)',
            backfaceVisibility: 'hidden'
          }}
        >
          <div className="space-y-4">
            <p className="font-serif italic text-lg text-[#5A5A40]/40 uppercase tracking-[0.3em]">Postcard</p>
            <div className="w-32 h-[1px] bg-[#5A5A40]/10 mx-auto" />
            <p className="font-serif italic text-sm text-[#5A5A40]/60 leading-relaxed px-4">
              {postcard.backContent || postcard.content}
            </p>
          </div>
          <div className="absolute top-8 right-8 w-12 h-16 border border-[#5A5A40]/20 rounded-sm opacity-30" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function AppContent() {
  const [postcards, setPostcards] = useState<PostcardData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [editData, setEditData] = useState<Partial<PostcardData>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedPostcard = postcards.find(p => p.id === selectedId);

  // Sync with Firestore
  useEffect(() => {
    const q = query(collection(db, 'postcards'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PostcardData));
      
      // If no postcards in DB, use initial ones as a starting point (local only for now)
      if (docs.length === 0) {
        setPostcards(INITIAL_POSTCARDS.map((p, i) => ({ ...p, id: `local-${i}` } as PostcardData)));
      } else {
        setPostcards(docs);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'postcards');
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    if (!selectedId) return;
    
    try {
      if (selectedId.startsWith('local-')) {
        // Create new in Firestore
        const { id, ...data } = selectedPostcard!;
        await addDoc(collection(db, 'postcards'), {
          ...data,
          ...editData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Update existing in Firestore
        await updateDoc(doc(db, 'postcards', selectedId), {
          ...editData,
          updatedAt: serverTimestamp()
        });
      }
      setIsEditing(false);
      setSelectedId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `postcards/${selectedId}`);
    }
  };

  const handleNext = () => {
    const currentIndex = postcards.findIndex(p => p.id === selectedId);
    const nextIndex = (currentIndex + 1) % postcards.length;
    setSelectedId(postcards[nextIndex].id);
    setIsEditing(false);
  };

  const handlePrev = () => {
    const currentIndex = postcards.findIndex(p => p.id === selectedId);
    const prevIndex = (currentIndex - 1 + postcards.length) % postcards.length;
    setSelectedId(postcards[prevIndex].id);
    setIsEditing(false);
  };

  const startEditing = () => {
    if (selectedPostcard) {
      setEditData({
        title: selectedPostcard.title,
        location: selectedPostcard.location,
        content: selectedPostcard.content,
        backContent: selectedPostcard.backContent,
        image: selectedPostcard.image,
      });
      setIsEditing(true);
    }
  };

  const handleAddPostcard = async () => {
    const newPostcardData = {
      title: "New Adventure",
      location: "Unknown Location",
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      content: "Write your story here...",
      backContent: "Write a message for the back...",
      image: "https://picsum.photos/seed/new/600/800",
      rotation: Math.random() * 20 - 10,
      x: Math.random() * 80 + 10,
      y: Math.random() * 80 + 10,
      updatedAt: serverTimestamp()
    };

    try {
      const docRef = await addDoc(collection(db, 'postcards'), newPostcardData);
      setSelectedId(docRef.id);
      setEditData(newPostcardData);
      setIsEditing(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'postcards');
    }
  };

  const compressImage = (base64Str: string, maxWidth = 1200, maxHeight = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          // Compress image before setting it to state
          const compressed = await compressImage(base64);
          setEditData(prev => ({ ...prev, image: compressed }));
        } catch (error) {
          console.error("Compression failed", error);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: string) => {
    if (id.startsWith('local-')) {
      // Just remove from local state if it's one of the initial ones
      setPostcards(prev => prev.filter(p => p.id !== id));
    } else {
      try {
        await deleteDoc(doc(db, 'postcards', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `postcards/${id}`);
      }
    }
    setSelectedId(null);
    setIsEditing(false);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1542332213-9b5a5a3fad35?auto=format&fit=crop&w=1920&q=80)' }}>
      {/* Frosted Glass Overlay (毛玻璃) */}
      <div className="absolute inset-0 bg-green-900/10 backdrop-blur-xl pointer-events-none z-0" />
      
      {/* Background Texture Overlay */}
      <div className="absolute inset-0 opacity-20 pointer-events-none z-0" 
           style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* Header */}
      <header className="relative z-10 p-8 md:p-12 flex justify-between items-start backdrop-blur-sm bg-white/5 border-b border-white/10">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-5xl md:text-7xl font-light tracking-tight text-[#5A5A40]"
          >
            Panny 的 <span className="italic text-3xl md:text-4xl opacity-60 block md:inline ml-0 md:ml-4">小竹子林</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-sm uppercase tracking-[0.2em] text-[#5A5A40]/60 font-medium"
          >
            时光中捕捉的每一片竹叶
          </motion.p>
        </div>

        {/* Action Buttons */}
        <div className="relative z-20 flex items-center gap-4">
          <button 
            onClick={handleAddPostcard}
            className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-sm text-xs uppercase tracking-widest font-medium hover:bg-[#4A4A30] transition-all shadow-lg"
          >
            <Plus size={18} /> Create Postcard
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            className="hidden" 
            accept="image/*"
          />
        </div>
      </header>

      {/* Postcard Horizontal List */}
      <main className="relative w-full h-screen flex items-center overflow-x-auto overflow-y-hidden bg-white/5 px-[10vw] gap-12 no-scrollbar scroll-smooth">
        {/* Ambient Light & Atmosphere */}
        <div className="fixed inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/10 pointer-events-none z-10" />
        
        <div className="flex items-center gap-16 py-20 min-w-max">
          {postcards.map((postcard, index) => (
            <PostcardItem 
              key={postcard.id} 
              postcard={postcard} 
              index={index} 
              onSelect={() => setSelectedId(postcard.id)} 
            />
          ))}
        </div>

        {/* Navigation Hint */}
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 pointer-events-none z-20">
          <div className="flex items-center gap-4">
            <ArrowLeft size={14} className="text-[#5A5A40]/30 animate-pulse" />
            <div className="w-24 h-[1px] bg-[#5A5A40]/20 relative">
              <motion.div 
                className="absolute top-[-2px] left-0 w-1 h-1 bg-[#5A5A40] rounded-full"
                animate={{ left: ["0%", "100%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            <motion.div style={{ rotate: 180 }}><ArrowLeft size={14} className="text-[#5A5A40]/30 animate-pulse" /></motion.div>
          </div>
          <p className="text-[10px] uppercase tracking-[0.5em] text-[#5A5A40]/50 font-semibold">Scroll & Drag to Flip</p>
        </div>
      </main>


      {/* Detail Overlay */}
      {/* Detail Overlay */}
      <AnimatePresence mode="wait">
        {selectedId && selectedPostcard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              if (!isEditing) setSelectedId(null);
            }}
          >
            <motion.div
              layoutId={`postcard-${selectedPostcard.id}`}
              className="relative bg-white shadow-2xl max-w-4xl w-full rounded-2xl overflow-hidden flex flex-col md:flex-row h-auto max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button - Subtle and out of the way */}
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setSelectedId(null);
                }}
                className="absolute top-4 right-4 z-50 p-2 text-gray-300 hover:text-gray-500 transition-colors"
                title="Close"
              >
                <X size={20} />
              </button>

              {/* Image Section - Left side in landscape */}
              <div className="w-full md:w-1/2 relative group overflow-hidden bg-gray-50 min-h-[300px] md:min-h-[500px]">
                <AnimatePresence mode="wait">
                  <motion.img 
                    key={editData.image || selectedPostcard.image}
                    src={editData.image || selectedPostcard.image} 
                    alt={selectedPostcard.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                </AnimatePresence>
                
                {isEditing && (
                  <button 
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white gap-2 transition-opacity disabled:opacity-50"
                  >
                    {isUploading ? (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                    ) : (
                      <ImageIcon size={32} />
                    )}
                    <span className="text-[10px] uppercase tracking-widest font-bold">
                      {isUploading ? 'Processing...' : 'Change Image'}
                    </span>
                  </button>
                )}

                {!isEditing && (
                  <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/80 via-black/20 to-transparent text-white">
                    <h2 className="font-serif text-3xl mb-2">{selectedPostcard.title}</h2>
                    <p className="text-xs uppercase tracking-[0.2em] opacity-80 flex items-center gap-2">
                      <MapPin size={12} /> {selectedPostcard.location}
                    </p>
                  </div>
                )}
              </div>

              {/* Content Section - Right side in landscape */}
              <div className="w-full md:w-1/2 p-8 md:p-12 bg-white overflow-y-auto no-scrollbar">
                <div className="h-full flex flex-col">
                  {isEditing ? (
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-4">
                        <button 
                          onClick={() => setIsEditing(false)}
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <ArrowLeft size={18} />
                        </button>
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">Editing Mode</span>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Title</label>
                        <input 
                          value={editData.title}
                          onChange={(e) => setEditData({...editData, title: e.target.value})}
                          className="w-full font-serif text-2xl text-[#5A5A40] border-b border-gray-100 focus:outline-none focus:border-[#5A5A40] py-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Location</label>
                        <input 
                          value={editData.location}
                          onChange={(e) => setEditData({...editData, location: e.target.value})}
                          className="w-full text-sm text-gray-500 border-b border-gray-100 focus:outline-none py-2"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Front Message</label>
                        <textarea 
                          value={editData.content}
                          onChange={(e) => setEditData({...editData, content: e.target.value})}
                          className="w-full h-24 text-sm text-gray-600 border border-gray-100 p-4 rounded-xl focus:outline-none focus:border-[#5A5A40]/20 resize-none leading-relaxed no-scrollbar"
                          placeholder="Front message..."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Back Side Note</label>
                        <textarea 
                          value={editData.backContent}
                          onChange={(e) => setEditData({...editData, backContent: e.target.value})}
                          className="w-full h-24 text-sm text-gray-600 border border-gray-100 p-4 rounded-xl focus:outline-none focus:border-[#5A5A40]/20 resize-none leading-relaxed no-scrollbar"
                          placeholder="Back message..."
                        />
                      </div>
                      <button 
                        onClick={handleSave}
                        className="w-full py-5 bg-[#5A5A40] text-white rounded-2xl text-xs uppercase tracking-[0.2em] font-bold hover:bg-[#4A4A30] transition-all shadow-2xl flex items-center justify-center gap-3 mt-4"
                      >
                        <Save size={18} /> Save Postcard
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-8 pt-12 md:pt-0">
                      <div className="space-y-6">
                        <div className="relative">
                          <span className="absolute -left-3 -top-2 text-5xl text-[#5A5A40]/10 font-serif">"</span>
                          <p className="text-lg text-[#5A5A40]/80 italic leading-relaxed pl-6">
                            {selectedPostcard.content}
                          </p>
                        </div>
                        
                        {selectedPostcard.backContent && (
                          <div className="pt-8 border-t border-gray-100">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-300 mb-4 font-bold">Reverse Side</p>
                            <div className="relative bg-[#fdfcf9] p-6 rounded-2xl border border-black/[0.03] shadow-inner">
                              <p className="text-sm text-gray-500 italic leading-relaxed">
                                {selectedPostcard.backContent}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-auto pt-8 border-t border-gray-100 flex justify-between items-center">
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                            <Calendar size={14} /> {selectedPostcard.date}
                          </div>
                          
                          {/* Subtle Edit/Delete Actions */}
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={startEditing}
                              className="p-2 text-gray-300 hover:text-[#5A5A40] hover:bg-gray-50 rounded-full transition-all"
                              title="Edit"
                            >
                              <Edit3 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDelete(selectedPostcard.id)}
                              className="p-2 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-full transition-all"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <p className="text-[9px] uppercase tracking-[0.3em] text-gray-300">Authentic Archive</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Instructions */}
      <footer className="fixed bottom-8 left-8 right-8 flex justify-between items-center pointer-events-none z-10">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#5A5A40]/40">
          Cloud Persistence • 3D Interaction
        </div>
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#5A5A40]/40 hidden md:block">
          Click to edit • Drag to flip
        </div>
      </footer>
    </div>
  );
}
