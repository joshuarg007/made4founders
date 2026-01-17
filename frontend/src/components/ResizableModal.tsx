import { useState, useRef, useEffect, type ReactNode } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface ResizableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export default function ResizableModal({
  isOpen,
  onClose,
  title,
  children,
  initialWidth = 500,
  initialHeight = 400,
  minWidth = 320,
  minHeight = 200,
  maxWidth = 1200,
  maxHeight = 900,
}: ResizableModalProps) {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isMaximized, setIsMaximized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const startSize = useRef({ width: 0, height: 0 });

  // Store size before maximizing
  const prevSize = useRef(size);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeDirection) return;

      const deltaX = e.clientX - startPos.current.x;
      const deltaY = e.clientY - startPos.current.y;

      let newWidth = startSize.current.width;
      let newHeight = startSize.current.height;

      if (resizeDirection.includes('e')) {
        newWidth = Math.min(maxWidth, Math.max(minWidth, startSize.current.width + deltaX * 2));
      }
      if (resizeDirection.includes('s')) {
        newHeight = Math.min(maxHeight, Math.max(minHeight, startSize.current.height + deltaY * 2));
      }

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeDirection(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeDirection, minWidth, minHeight, maxWidth, maxHeight]);

  const startResize = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    startPos.current = { x: e.clientX, y: e.clientY };
    startSize.current = { ...size };
    document.body.style.cursor = direction === 'se' ? 'se-resize' : direction === 'e' ? 'ew-resize' : 'ns-resize';
    document.body.style.userSelect = 'none';
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setSize(prevSize.current);
    } else {
      prevSize.current = size;
      setSize({
        width: Math.min(window.innerWidth - 48, maxWidth),
        height: Math.min(window.innerHeight - 48, maxHeight)
      });
    }
    setIsMaximized(!isMaximized);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="relative bg-[#1a1d24] rounded-xl border border-white/10 flex flex-col"
        style={{
          width: isMaximized ? `min(calc(100vw - 48px), ${maxWidth}px)` : `${size.width}px`,
          height: isMaximized ? `min(calc(100vh - 48px), ${maxHeight}px)` : `${size.height}px`,
          maxWidth: '100%',
          maxHeight: '100%',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMaximize}
              className="p-1 text-gray-500 hover:text-white transition"
              title={isMaximized ? 'Restore' : 'Maximize'}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>

        {/* Resize handles */}
        {!isMaximized && (
          <>
            {/* Right edge */}
            <div
              className="absolute top-4 bottom-4 right-0 w-2 cursor-ew-resize hover:bg-cyan-500/20 transition"
              onMouseDown={(e) => startResize(e, 'e')}
            />
            {/* Bottom edge */}
            <div
              className="absolute left-4 right-4 bottom-0 h-2 cursor-ns-resize hover:bg-cyan-500/20 transition"
              onMouseDown={(e) => startResize(e, 's')}
            />
            {/* Corner */}
            <div
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
              onMouseDown={(e) => startResize(e, 'se')}
            >
              <div className="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-gray-600 group-hover:border-cyan-500 transition" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
