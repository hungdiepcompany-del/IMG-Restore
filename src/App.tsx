/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useCallback, useEffect, ChangeEvent, MouseEvent, TouchEvent } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Upload, 
  RefreshCw, 
  Download, 
  Image as ImageIcon, 
  Loader2, 
  AlertCircle,
  ChevronRight,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- CONFIG ---
const GEMINI_MODEL = "gemini-2.5-flash-image";
// Prompt provided by user (placeholder since none was explicitly pasted in the request, 
// but I will use a high-quality one as requested).
const RESTORATION_PROMPT = "Restore this old photo, remove scratches, noise, and damage. Colorize it with natural skin tones and realistic colors. High quality, sharp details, professional restoration.";

export default function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [restoredImage, setRestoredImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [quality, setQuality] = useState<'Standard' | 'High' | 'Ultra'>('Standard');
  const [isColorized, setIsColorized] = useState(true);
  const [artStyle, setArtStyle] = useState<'Realistic' | 'OilPainting'>('Realistic');
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError("File quá lớn. Vui lòng chọn ảnh dưới 10MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setOriginalImage(event.target?.result as string);
        setRestoredImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRestore = async () => {
    if (!originalImage) return;

    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Extract base64 data
      const base64Data = originalImage.split(',')[1];
      const mimeType = originalImage.split(';')[0].split(':')[1];

      let prompt = "";
      const colorInstruction = isColorized 
        ? "Colorize it with natural skin tones and realistic colors." 
        : "Keep the photo in its original black and white or grayscale tones. Do not add any new colors.";
      
      const styleInstruction = artStyle === 'OilPainting'
        ? "Transform this photo into a beautiful oil painting. Use rich textures, visible brushstrokes, and vibrant colors typical of a classic oil on canvas masterpiece. Maintain the composition but render it in an artistic, painterly style."
        : "";

      const preservationInstruction = "Strictly preserve the original facial features, head shape, hair texture, and shoulder lines. Do not alter the person's identity or physical structure.";
      
      if (quality === 'Standard') {
        prompt = `Restore this old photo, remove scratches, noise, and damage. ${colorInstruction} ${styleInstruction} ${preservationInstruction} High quality, sharp details, professional restoration.`;
      } else if (quality === 'High') {
        prompt = `Restore this old photo with maximum detail, remove all scratches, noise, and damage. ${colorInstruction} ${styleInstruction} ${preservationInstruction} High quality, sharp details, professional restoration.`;
      } else if (quality === 'Ultra') {
        prompt = `Perform an ultra-high-definition restoration of this old photograph. Meticulously remove every scratch, dust particle, and blemish. Reconstruct missing details with AI precision. ${isColorized ? "Apply sophisticated colorization with multi-layered skin tones, realistic textures, and cinematic color grading." : "Maintain the original black and white aesthetic with enhanced contrast and clarity."} ${styleInstruction} ${preservationInstruction} The output must be sharp, noise-free, and look like a modern high-resolution photograph while preserving the original essence.`;
      }

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const resultBase64 = part.inlineData.data;
          setRestoredImage(`data:image/png;base64,${resultBase64}`);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error("Không nhận được ảnh kết quả từ AI.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Đã có lỗi xảy ra trong quá trình xử lý.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!restoredImage) return;
    const link = document.createElement('a');
    link.href = restoredImage;
    link.download = 'IMGRestore-Result.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setOriginalImage(null);
    setRestoredImage(null);
    setError(null);
    setSliderPosition(50);
  };

  const onMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const position = ((x - rect.left) / rect.width) * 100;
    
    setSliderPosition(Math.min(Math.max(position, 0), 100));
  }, [isDragging]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove as any);
      window.addEventListener('touchmove', onMouseMove as any);
      window.addEventListener('mouseup', () => setIsDragging(false));
      window.addEventListener('touchend', () => setIsDragging(false));
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove as any);
      window.removeEventListener('touchmove', onMouseMove as any);
    };
  }, [isDragging, onMouseMove]);

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6">
      {/* Header */}
      <header className="text-center mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-semibold tracking-tight text-[#1D1D1F] mb-2"
        >
          IMG Restore
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-lg text-[#86868B] font-medium"
        >
          Phục chế & Tô màu ảnh cổ
        </motion.p>
      </header>

      <main className="w-full max-w-4xl">
        <AnimatePresence mode="wait">
          {!originalImage ? (
            /* Upload Section */
            <motion.div
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-sm border border-[#D2D2D7]/30 p-12 flex flex-col items-center justify-center cursor-pointer hover:border-[#0071E3] transition-colors group"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const input = { target: { files: [file] } } as any;
                  handleFileUpload(input);
                }
              }}
            >
              <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center mb-6 group-hover:bg-[#E8F2FF] transition-colors">
                <Upload className="w-8 h-8 text-[#86868B] group-hover:text-[#0071E3] transition-colors" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Tải ảnh lên để bắt đầu</h2>
              <p className="text-[#86868B] text-center max-w-xs">
                Kéo và thả ảnh vào đây hoặc nhấp để chọn từ thiết bị (JPG, PNG, WEBP)
              </p>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload}
              />
            </motion.div>
          ) : (
            /* Preview & Result Section */
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* Comparison View */}
              <div 
                ref={containerRef}
                className="relative aspect-square sm:aspect-video w-full bg-black rounded-3xl overflow-hidden shadow-2xl group select-none"
              >
                {/* Before Image (Base) */}
                <img 
                  src={originalImage} 
                  alt="Original" 
                  className="absolute inset-0 w-full h-full object-contain"
                />

                {/* After Image (Overlay) */}
                {restoredImage && (
                  <div 
                    className="absolute inset-0 w-full h-full overflow-hidden"
                    style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
                  >
                    <img 
                      src={restoredImage} 
                      alt="Restored" 
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  </div>
                )}

                {/* Labels */}
                <div className="absolute top-4 left-4 glass px-3 py-1 rounded-full text-xs font-semibold z-10">
                  BEFORE
                </div>
                {restoredImage && (
                  <div className="absolute top-4 right-4 glass px-3 py-1 rounded-full text-xs font-semibold z-10">
                    AFTER
                  </div>
                )}

                {/* Slider UI */}
                {restoredImage && (
                  <>
                    <div 
                      className="slider-line" 
                      style={{ left: `${sliderPosition}%` }}
                    />
                    <div 
                      className="slider-handle absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                      style={{ left: `${sliderPosition}%` }}
                      onMouseDown={() => setIsDragging(true)}
                      onTouchStart={() => setIsDragging(true)}
                    >
                      <div className="flex gap-1">
                        <div className="w-0.5 h-4 bg-[#D2D2D7] rounded-full" />
                        <div className="w-0.5 h-4 bg-[#D2D2D7] rounded-full" />
                      </div>
                    </div>
                  </>
                )}

                {/* Processing Overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-40">
                    <Loader2 className="w-12 h-12 text-[#0071E3] animate-spin mb-4" />
                    <p className="text-lg font-semibold text-[#1D1D1F]">Đang phục chế ảnh...</p>
                    <p className="text-sm text-[#86868B]">Quá trình này có thể mất vài giây</p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3 text-red-600"
                >
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col items-center gap-6">
                {!restoredImage ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="flex flex-wrap justify-center items-center gap-4">
                      {/* Quality Selector */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#86868B] font-bold ml-2">Chất lượng</span>
                        <div className="flex items-center bg-white border border-[#D2D2D7] rounded-full p-1 shadow-sm">
                          <button
                            onClick={() => setQuality('Standard')}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                              quality === 'Standard' 
                                ? 'bg-[#1D1D1F] text-white shadow-md' 
                                : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                            }`}
                          >
                            Tiêu chuẩn
                          </button>
                          <button
                            onClick={() => setQuality('High')}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                              quality === 'High' 
                                ? 'bg-[#1D1D1F] text-white shadow-md' 
                                : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                            }`}
                          >
                            Chất lượng cao
                          </button>
                          <button
                            onClick={() => setQuality('Ultra')}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                              quality === 'Ultra' 
                                ? 'bg-[#1D1D1F] text-white shadow-md' 
                                : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                            }`}
                          >
                            Siêu cấp
                          </button>
                        </div>
                      </div>

                      {/* Colorization Toggle */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#86868B] font-bold ml-2">Chế độ màu</span>
                        <div className="flex items-center bg-white border border-[#D2D2D7] rounded-full p-1 shadow-sm">
                          <button
                            onClick={() => setIsColorized(true)}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                              isColorized 
                                ? 'bg-[#0071E3] text-white shadow-md' 
                                : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                            }`}
                          >
                            Tô màu AI
                          </button>
                          <button
                            onClick={() => setIsColorized(false)}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                              !isColorized 
                                ? 'bg-[#1D1D1F] text-white shadow-md' 
                                : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                            }`}
                          >
                            Đen trắng
                          </button>
                        </div>
                      </div>

                      {/* Style Toggle */}
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase tracking-wider text-[#86868B] font-bold ml-2">Phong cách</span>
                        <div className="flex items-center bg-white border border-[#D2D2D7] rounded-full p-1 shadow-sm">
                          <button
                            onClick={() => setArtStyle('Realistic')}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                              artStyle === 'Realistic' 
                                ? 'bg-[#1D1D1F] text-white shadow-md' 
                                : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                            }`}
                          >
                            Ảnh thực
                          </button>
                          <button
                            onClick={() => setArtStyle('OilPainting')}
                            className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                              artStyle === 'OilPainting' 
                                ? 'bg-[#8E44AD] text-white shadow-md' 
                                : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                            }`}
                          >
                            Sơn dầu
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleRestore}
                      disabled={isProcessing}
                      className="bg-[#0071E3] text-white px-12 py-4 rounded-full font-semibold text-lg flex items-center gap-2 hover:bg-[#0077ED] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                      Bắt đầu phục chế
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-4">
                    <button
                      onClick={handleDownload}
                      disabled={isProcessing}
                      className="bg-white text-[#1D1D1F] border border-[#D2D2D7] px-8 py-4 rounded-full font-semibold text-lg flex items-center gap-2 hover:bg-[#F5F5F7] transition-colors shadow-sm disabled:opacity-50"
                    >
                      <Download className="w-5 h-5" />
                      Tải ảnh After
                    </button>
                    <button
                      onClick={handleRestore}
                      disabled={isProcessing}
                      className="bg-white text-[#1D1D1F] border border-[#D2D2D7] px-8 py-4 rounded-full font-semibold text-lg flex items-center gap-2 hover:bg-[#F5F5F7] transition-colors shadow-sm disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                      Phục chế lại
                    </button>
                    <button
                      onClick={handleReset}
                      disabled={isProcessing}
                      className="bg-[#F5F5F7] text-[#1D1D1F] px-8 py-4 rounded-full font-semibold text-lg flex items-center gap-2 hover:bg-[#E8E8ED] transition-colors disabled:opacity-50"
                    >
                      <History className="w-5 h-5" />
                      Làm lại
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Info */}
      <footer className="mt-20 text-center text-[#86868B] text-sm pb-8">
        <p>© 2026 IMG Restore • Công nghệ AI Phục chế Ảnh</p>
        <p className="mt-2 text-[#0071E3] font-medium">Creator: <a href="mailto:giadinhphamvan@gmail.com" className="hover:underline transition-all">giadinhphamvan@gmail.com</a></p>
      </footer>
    </div>
  );
}
