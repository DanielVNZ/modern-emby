import React from 'react';

interface SectionRowDraggableProps {
  id: string;
  index: number;
  isFocused: boolean;
  isPicked: boolean;
  dragHandleProps: React.HTMLAttributes<HTMLDivElement> & { ref?: (el: HTMLElement | null) => void };
  children: React.ReactNode;
}

export function SectionRowDraggable({
  id,
  index,
  isFocused,
  isPicked,
  dragHandleProps,
  children,
}: SectionRowDraggableProps) {
  const localRef = (el: HTMLElement | null) => {
    const { ref } = dragHandleProps as any;
    if (typeof ref === 'function') ref(el);
    else if (ref && typeof ref === 'object') (ref as any).current = el;
  };

  return (
    <div
      ref={localRef}
      data-draggable-sectionid={id}
      data-index={index}
      {...dragHandleProps}
      className={
        'relative transition-all duration-200 rounded-lg will-change-transform' +
        (isPicked ? ' ring-4 ring-green-500 bg-green-500/10 shadow-2xl shadow-green-500/50 z-20 scale-[1.02]' : '') +
        (isFocused && !isPicked ? ' ring-2 ring-blue-400 bg-blue-500/5' : '') +
        (!isFocused && !isPicked ? ' hover:ring-2 hover:ring-blue-400/50' : '')
      }
      style={{ cursor: isPicked ? 'grabbing' : 'grab', transitionProperty: 'transform, box-shadow, background-color' }}
    >
      {children}
      {isPicked && (
        <div className="absolute top-4 right-4 px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
          PICKED UP - Use ↑↓ or Click to Place
        </div>
      )}
    </div>
  );
}
