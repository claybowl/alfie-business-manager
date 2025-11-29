import React, { useState, useEffect, useRef } from 'react';
import {
  fetchNotes,
  createTextNote,
  createLinkNote,
  uploadImage,
  deleteNote,
  togglePin,
  updateNote,
  AlfieNote
} from '../utils/notes';

type NoteInputMode = 'text' | 'link' | 'image';

export const NotesPanel: React.FC = () => {
  const [notes, setNotes] = useState<AlfieNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputMode, setInputMode] = useState<NoteInputMode>('text');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  
  // Form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteUrl, setNoteUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pastedImagePreview, setPastedImagePreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load notes on mount
  useEffect(() => {
    loadNotes();
  }, []);

  // Clipboard paste handler for screenshots
  useEffect(() => {
    if (inputMode !== 'image') return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          
          const file = item.getAsFile();
          if (!file) continue;

          // Validate
          if (file.size > 5 * 1024 * 1024) {
            alert('Image size must be less than 5MB');
            return;
          }

          // Show preview
          const reader = new FileReader();
          reader.onload = (event) => {
            setPastedImagePreview(event.target?.result as string);
          };
          reader.readAsDataURL(file);

          // Upload
          await handleImageUploadFromFile(file);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [inputMode]);

  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const fetchedNotes = await fetchNotes(false);
      setNotes(fetchedNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (inputMode === 'text' && !noteContent.trim()) return;
    if (inputMode === 'link' && !noteUrl.trim()) return;

    try {
      if (inputMode === 'text') {
        await createTextNote(noteContent, noteTitle || undefined);
      } else if (inputMode === 'link') {
        await createLinkNote(noteUrl, noteTitle || undefined, noteContent || undefined);
      }

      setNoteTitle('');
      setNoteContent('');
      setNoteUrl('');
      await loadNotes();
    } catch (error) {
      console.error('Failed to create note:', error);
      alert('Failed to create note. Please try again.');
    }
  };

  const handleImageUploadFromFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploadingImage(true);
    try {
      await uploadImage(file, noteTitle || file.name, noteContent || undefined);
      
      setNoteTitle('');
      setNoteContent('');
      setPastedImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      await loadNotes();
    } catch (error) {
      console.error('Failed to upload image:', error);
      alert('Failed to upload image. Make sure Supabase is configured.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleImageUploadFromFile(file);
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Delete this note? This cannot be undone.')) return;
    await deleteNote(id);
    await loadNotes();
  };

  const handleTogglePin = async (id: string, isPinned: boolean) => {
    await togglePin(id, !isPinned);
    await loadNotes();
  };

  const handleUpdateNote = async (id: string, content: string) => {
    await updateNote(id, { content });
    setEditingNoteId(null);
    await loadNotes();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-200 mb-2">Notes to Alfie</h2>
          <p className="text-sm text-gray-500">
            Add context, links, and screenshots that Alfie should know about.
          </p>
        </div>
      </div>

      {/* Input Mode Selector */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        <button
          onClick={() => setInputMode('text')}
          className={`px-4 py-2 rounded-t text-sm font-mono transition-all ${
            inputMode === 'text'
              ? 'bg-amber-900/30 text-amber-300 border-b-2 border-amber-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          📝 Text
        </button>
        <button
          onClick={() => setInputMode('link')}
          className={`px-4 py-2 rounded-t text-sm font-mono transition-all ${
            inputMode === 'link'
              ? 'bg-blue-900/30 text-blue-300 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          🔗 Link
        </button>
        <button
          onClick={() => setInputMode('image')}
          className={`px-4 py-2 rounded-t text-sm font-mono transition-all ${
            inputMode === 'image'
              ? 'bg-purple-900/30 text-purple-300 border-b-2 border-purple-500'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          📷 Image
        </button>
      </div>

      {/* Input Form */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
        <input
          type="text"
          value={noteTitle}
          onChange={(e) => setNoteTitle(e.target.value)}
          placeholder="Title (optional)"
          className="w-full mb-3 px-3 py-2 bg-black/30 border border-gray-700 rounded text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50"
        />

        {inputMode === 'text' && (
          <>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add your note..."
              className="w-full h-32 px-3 py-2 bg-black/30 border border-gray-700 rounded text-gray-300 text-sm font-mono placeholder:text-gray-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleCreateNote}
                disabled={!noteContent.trim()}
                className="px-4 py-2 bg-amber-600/20 text-amber-400 border border-amber-600/30 rounded font-mono text-sm hover:bg-amber-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + ADD NOTE
              </button>
            </div>
          </>
        )}

        {inputMode === 'link' && (
          <>
            <input
              type="url"
              value={noteUrl}
              onChange={(e) => setNoteUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full mb-3 px-3 py-2 bg-black/30 border border-gray-700 rounded text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50"
            />
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Description (optional)"
              className="w-full h-20 px-3 py-2 bg-black/30 border border-gray-700 rounded text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 resize-none"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleCreateNote}
                disabled={!noteUrl.trim()}
                className="px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded font-mono text-sm hover:bg-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                + ADD LINK
              </button>
            </div>
          </>
        )}

        {inputMode === 'image' && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            {pastedImagePreview && (
              <div className="mb-3 relative">
                <img
                  src={pastedImagePreview}
                  alt="Pasted"
                  className="w-full rounded border border-purple-500/50"
                />
                <button
                  onClick={() => setPastedImagePreview(null)}
                  className="absolute top-2 right-2 px-2 py-1 bg-red-600/80 text-white text-xs rounded hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            )}
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="w-full px-4 py-8 bg-black/30 border-2 border-dashed border-gray-700 rounded text-gray-400 hover:border-purple-500/50 hover:text-purple-300 transition-all disabled:opacity-50"
            >
              {uploadingImage ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                  Uploading...
                </span>
              ) : (
                <>
                  📷 Click to upload or <strong className="text-purple-400">Ctrl+V to paste</strong>
                  <br />
                  <span className="text-xs text-gray-600 mt-2 block">PNG, JPG, GIF up to 5MB</span>
                </>
              )}
            </button>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Description (optional)"
              className="w-full h-20 mt-3 px-3 py-2 bg-black/30 border border-gray-700 rounded text-gray-300 text-sm placeholder:text-gray-600 focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </>
        )}
      </div>

      {/* Notes List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-600">
          <div className="w-8 h-8 mx-auto mb-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm">Loading notes...</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-12 text-gray-600 bg-gray-900/20 border border-gray-800 rounded-lg">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-sm">No notes yet</p>
          <p className="text-xs text-gray-700 mt-1">Add your first note above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isEditing={editingNoteId === note.id}
              onEdit={() => setEditingNoteId(note.id)}
              onCancelEdit={() => setEditingNoteId(null)}
              onSave={(content) => handleUpdateNote(note.id, content)}
              onDelete={() => handleDeleteNote(note.id)}
              onTogglePin={() => handleTogglePin(note.id, note.is_pinned)}
            />
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="p-4 bg-blue-900/10 border border-blue-800/30 rounded-lg">
        <h3 className="text-sm font-bold text-blue-300 mb-2">💡 Tips:</h3>
        <ul className="text-xs text-blue-200/70 space-y-1">
          <li>• <strong>Text & Link notes</strong> work immediately with localStorage</li>
          <li>• <strong>Image uploads</strong> require Supabase setup (run <code className="px-1 bg-blue-900/30 rounded">migrations/002_notes_system.sql</code>)</li>
          <li>• <strong>Paste screenshots</strong> with Ctrl+V while in Image mode</li>
          <li>• <strong>Pin</strong> important notes to keep them at the top</li>
        </ul>
      </div>
    </div>
  );
};

// Note Card Component
const NoteCard: React.FC<{
  note: AlfieNote;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (content: string) => void;
  onDelete: () => void;
  onTogglePin: () => void;
}> = ({ note, isEditing, onEdit, onCancelEdit, onSave, onDelete, onTogglePin }) => {
  const [editContent, setEditContent] = useState(note.content);

  const getCardStyle = () => {
    if (note.is_pinned) return 'bg-amber-900/10 border-amber-800/30';
    switch (note.note_type) {
      case 'link': return 'bg-blue-900/10 border-blue-800/30';
      case 'image': return 'bg-purple-900/10 border-purple-800/30';
      default: return 'bg-gray-900/40 border-gray-800';
    }
  };

  const getIcon = () => {
    if (note.is_pinned) return '📌';
    switch (note.note_type) {
      case 'link': return '🔗';
      case 'image': return '📷';
      default: return '📝';
    }
  };

  return (
    <div className={`border rounded-lg p-4 transition-all ${getCardStyle()}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getIcon()}</span>
          {note.title && <h3 className="text-sm font-semibold text-gray-200">{note.title}</h3>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onTogglePin}
            className={`p-1 text-xs rounded hover:bg-gray-800/50 ${note.is_pinned ? 'text-amber-400' : 'text-gray-600'}`}
          >
            📌
          </button>
          <button
            onClick={onDelete}
            className="p-1 text-xs text-red-400 hover:bg-red-900/20 rounded"
          >
            🗑️
          </button>
        </div>
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-24 px-3 py-2 bg-black/30 border border-gray-700 rounded text-gray-300 text-sm focus:outline-none focus:border-amber-500/50 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onSave(editContent)}
              className="px-3 py-1 bg-green-600/20 text-green-400 border border-green-600/30 rounded text-xs hover:bg-green-600/30"
            >
              Save
            </button>
            <button
              onClick={onCancelEdit}
              className="px-3 py-1 bg-gray-700/20 text-gray-400 border border-gray-700/30 rounded text-xs hover:bg-gray-700/30"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {note.note_type === 'link' && note.url && (
            <a
              href={note.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm underline mb-2 block break-all"
            >
              {note.url}
            </a>
          )}

          {note.note_type === 'image' && note.file_url && (
            <a href={note.file_url} target="_blank" rel="noopener noreferrer" className="block mb-2">
              <img
                src={note.file_url}
                alt={note.title || 'Note'}
                className="w-full rounded border border-gray-700 hover:border-purple-500/50 transition-all"
              />
            </a>
          )}

          <p className="text-sm text-gray-300 whitespace-pre-wrap">{note.content}</p>

          <button onClick={onEdit} className="mt-2 text-xs text-gray-500 hover:text-gray-300">
            Edit
          </button>
        </>
      )}

      <div className="mt-3 pt-3 border-t border-gray-800/50 text-xs text-gray-600">
        {new Date(note.created_at).toLocaleDateString()} • {new Date(note.created_at).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default NotesPanel;
