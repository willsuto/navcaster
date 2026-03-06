import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useState } from 'react';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PanelWindowProps = {
  title: string;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  minWidth?: number;
  minHeight?: number;
  children: ReactNode;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function PanelWindow({
  title,
  initialX,
  initialY,
  initialWidth,
  initialHeight,
  minWidth = 280,
  minHeight = 160,
  children
}: PanelWindowProps) {
  const [rect, setRect] = useState<Rect>({
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: initialHeight
  });

  useEffect(() => {
    const handleViewportResize = () => {
      setRect((current) => {
        const maxWidth = Math.max(minWidth, window.innerWidth - 24);
        const maxHeight = Math.max(minHeight, window.innerHeight - 24);

        const width = clamp(current.width, minWidth, maxWidth);
        const height = clamp(current.height, minHeight, maxHeight);

        return {
          ...current,
          width,
          height,
          x: clamp(current.x, 0, window.innerWidth - width),
          y: clamp(current.y, 0, window.innerHeight - height)
        };
      });
    };

    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, [minHeight, minWidth]);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();

    const originX = event.clientX;
    const originY = event.clientY;
    const startRect = rect;

    const onMove = (moveEvent: PointerEvent) => {
      const nextX = startRect.x + (moveEvent.clientX - originX);
      const nextY = startRect.y + (moveEvent.clientY - originY);

      setRect((current) => ({
        ...current,
        x: clamp(nextX, 0, window.innerWidth - current.width),
        y: clamp(nextY, 0, window.innerHeight - current.height)
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const originX = event.clientX;
    const originY = event.clientY;
    const startRect = rect;

    const onMove = (moveEvent: PointerEvent) => {
      const maxWidth = Math.max(minWidth, window.innerWidth - startRect.x);
      const maxHeight = Math.max(minHeight, window.innerHeight - startRect.y);

      const width = clamp(startRect.width + (moveEvent.clientX - originX), minWidth, maxWidth);
      const height = clamp(startRect.height + (moveEvent.clientY - originY), minHeight, maxHeight);

      setRect((current) => ({
        ...current,
        width,
        height
      }));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <section
      className="panel-window"
      style={{
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: `translate(${rect.x}px, ${rect.y}px)`
      }}
    >
      <header className="panel-window__header" onPointerDown={startDrag}>
        <h2 className="panel-window__title">{title}</h2>
      </header>

      <div className="panel-window__content">{children}</div>

      <button
        type="button"
        className="panel-window__resize-handle"
        onPointerDown={startResize}
        aria-label={`Resize ${title} panel`}
      />
    </section>
  );
}

export default PanelWindow;
