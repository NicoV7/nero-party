import { useCallback, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { socket } from '../lib/socket';
import { usePartyStore } from '../stores/partyStore';

export default function Queue() {
  const songs = usePartyStore((s) => s.songs);
  const setSongs = usePartyStore((s) => s.setSongs);
  const isHost = usePartyStore((s) => s.isHost);
  const [expanded, setExpanded] = useState(true);

  const playingSong = songs.find((s) => s.status === 'playing');
  const queuedSongs = songs
    .filter((s) => s.status === 'queued')
    .sort((a, b) => a.position - b.position);
  const playedSongs = songs.filter((s) => s.status === 'played');

  const totalActive = queuedSongs.length + (playingSong ? 1 : 0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !isHost) return;

      const oldIndex = queuedSongs.findIndex((s) => s.id === active.id);
      const newIndex = queuedSongs.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(queuedSongs, oldIndex, newIndex);

      // Optimistic update: assign new positions locally so the list
      // doesn't snap back while waiting for the server round-trip.
      const optimistic = songs.map((s) => {
        const idx = reordered.findIndex((r) => r.id === s.id);
        if (idx !== -1) return { ...s, position: idx };
        return s;
      });
      setSongs(optimistic);

      socket.emit('reorder-queue', { songIds: reordered.map((s) => s.id) });
    },
    [songs, queuedSongs, isHost, setSongs]
  );

  const handlePlaySong = (songId: string) => {
    if (!isHost) return;
    socket.emit('play-song', { songId });
  };

  return (
    <div className="rounded-xl bg-nero-surface overflow-hidden flex-1 min-h-0 flex flex-col">
      {/* Header — click to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between border-b border-nero-border px-4 py-3 transition-[background-color,transform] duration-150 ease-[var(--ease-ui)] hover:bg-nero-surface-hover active:scale-[0.99]"
      >
        <h2 className="text-sm font-semibold text-nero-text uppercase tracking-widest">
          Up Next
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-nero-dim bg-nero-surface px-2 py-0.5 rounded-full">
            {queuedSongs.length} {queuedSongs.length === 1 ? 'song' : 'songs'}
          </span>
          <svg
            className={`w-4 h-4 text-nero-dim transition-transform duration-150 ease-[var(--ease-ui)] ${expanded ? 'rotate-180' : ''}`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </div>
      </button>

      {/* Queue content — collapsible + scrollable */}
      {expanded && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {totalActive === 0 && playedSongs.length === 0 ? (
            <div className="px-4 py-10 flex flex-col items-center">
              <svg className="w-10 h-10 text-nero-muted mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
              </svg>
              <p className="text-nero-text text-sm font-medium">Queue is empty</p>
              <p className="text-nero-dim text-xs mt-1">Add songs to get the party started</p>
            </div>
          ) : (
            <div className="divide-y divide-nero-border">
              {/* Currently playing */}
              {playingSong && (
                <QueueItem song={playingSong} badge="NOW PLAYING" />
              )}

              {/* Queued songs — draggable + clickable for host */}
              {isHost && queuedSongs.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis]}
                >
                  <SortableContext
                    items={queuedSongs.map((s) => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {queuedSongs.map((song, index) => (
                      <QueueItem
                        key={song.id}
                        song={song}
                        position={index + 1}
                        index={index}
                        draggable
                        onPlay={handlePlaySong}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              ) : (
                queuedSongs.map((song, index) => (
                  <QueueItem key={song.id} song={song} position={index + 1} index={index} />
                ))
              )}

              {/* Played songs */}
              {playedSongs.map((song) => (
                <QueueItem key={song.id} song={song} played />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SongItem {
  id: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  addedByName: string;
}

function QueueItem({
  song,
  badge,
  position,
  played,
  index,
  draggable,
  onPlay,
}: {
  song: SongItem;
  badge?: string;
  position?: number;
  played?: boolean;
  index?: number;
  draggable?: boolean;
  onPlay?: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: song.id, disabled: !draggable });

  const style = draggable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        animationDelay: index != null ? `${index * 50}ms` : undefined,
      }
    : index != null
    ? { animationDelay: `${index * 50}ms` }
    : undefined;

  return (
    <div
      ref={draggable ? setNodeRef : undefined}
      style={style}
      className={`group flex items-center gap-3 px-4 py-3 transition-[background-color,box-shadow,opacity] duration-150 ease-[var(--ease-ui)] ${
        index != null || draggable ? 'animate-stagger-in opacity-0' : ''
      } ${
        draggable
          ? isDragging
            ? 'cursor-pointer bg-nero-accent/10 shadow-lg opacity-90'
            : 'cursor-pointer hover:bg-nero-surface-hover'
          : played
          ? 'opacity-70'
          : 'hover:bg-nero-surface-hover'
      }`}
      onClick={draggable && onPlay ? () => onPlay(song.id) : undefined}
    >
      {/* Drag handle — only shown in draggable mode */}
      {draggable ? (
        <div
          {...attributes}
          {...listeners}
          className="flex w-6 shrink-0 touch-none items-center justify-center text-nero-dim transition-colors duration-150 ease-[var(--ease-ui)] hover:text-nero-text cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 6h2v2H8zm6 0h2v2h-2zM8 10h2v2H8zm6 0h2v2h-2zM8 14h2v2H8zm6 0h2v2h-2zM8 18h2v2H8zm6 0h2v2h-2z" />
          </svg>
        </div>
      ) : (
        /* Left indicator column for non-draggable mode */
        <div className="w-6 shrink-0 flex items-center justify-center">
          {badge ? (
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-nero-accent animate-pulse" />
          ) : position != null ? (
            <span className="text-xs font-medium text-nero-dim">{position}</span>
          ) : (
            <span className="text-xs text-nero-dim">--</span>
          )}
        </div>
      )}

      {/* Position number — only shown in draggable mode (drag handle replaces indicator) */}
      {draggable && position != null && (
        <span className="text-xs font-medium text-nero-dim w-5 text-center shrink-0">
          {position}
        </span>
      )}

      {/* 16:9 Thumbnail */}
      <div className="relative w-[120px] h-[68px] shrink-0 rounded-md overflow-hidden bg-nero-surface">
        <img
          src={song.thumbnailUrl}
          alt={song.title}
          className="w-full h-full object-cover"
        />
        {badge && !draggable && (
          <div className="absolute bottom-1 left-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-nero-bg bg-nero-accent px-1.5 py-0.5 rounded">
              {badge}
            </span>
          </div>
        )}
        {draggable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-150 ease-[var(--ease-ui)] group-hover:opacity-100">
            <svg className="ml-0.5 h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-nero-text truncate leading-snug">{song.title}</p>
        <p className="text-xs text-nero-muted truncate">{song.artist}</p>
        <p className="text-xs text-nero-dim truncate mt-0.5">
          Added by {song.addedByName}
        </p>
      </div>
    </div>
  );
}
