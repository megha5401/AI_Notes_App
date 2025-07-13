import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

function App() {
  // --- AUTH STATE ---
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [authError, setAuthError] = useState('');

  // --- NOTES STATE (per user) ---
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState({ title: '', content: '' });
  const [showArchived, setShowArchived] = useState(false);
  const MAX_PINNED = 3;

  // Load notes and dark mode from localStorage on mount
  useEffect(() => {
    const savedDark = localStorage.getItem('darkMode');
    if (savedDark === 'true') setDarkMode(true);
  }, []);

  // Save notes to localStorage when they change
  useEffect(() => {
    if (auth) {
      const key = `notes_${auth.isGuest ? 'guest' : auth.email}`;
      localStorage.setItem(key, JSON.stringify(notes));
    }
  }, [notes, auth]);

  // When user changes (login/logout), load their notes
  useEffect(() => {
    if (auth) {
      const key = `notes_${auth.isGuest ? 'guest' : auth.email}`;
      const saved = localStorage.getItem(key);
      setNotes(saved ? JSON.parse(saved) : []);
      setSelectedNoteId(null);
    }
  }, [auth]);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    document.body.className = darkMode ? 'dark' : '';
  }, [darkMode]);

  // Save auth to localStorage
  useEffect(() => {
    if (auth) localStorage.setItem('auth', JSON.stringify(auth));
    else localStorage.removeItem('auth');
  }, [auth]);

  // Get the currently selected note
  const selectedNote = notes.find(n => n.id === selectedNoteId);

  // When selected note changes, update edit buffer
  useEffect(() => {
    if (selectedNote) {
      setEditBuffer({
        title: selectedNote.title,
        content: selectedNote.content,
        todos: Array.isArray(selectedNote.todos) ? selectedNote.todos : [],
      });
    } else {
      setEditBuffer({ title: '', content: '', todos: [] });
    }
  }, [selectedNoteId, selectedNote]);

  // Create a new note
  const handleNewNote = () => {
    const newNote = {
      id: generateId(),
      title: 'Untitled Note',
      content: '',
      summary: '',
      date: new Date().toISOString(),
      archived: false,
      pinned: false,
      todos: [],
    };
    setNotes([newNote, ...notes]);
    setSelectedNoteId(newNote.id);
  };

  // Update edit buffer
  const handleEditBufferChange = (field, value) => {
    setEditBuffer(buf => ({ ...buf, [field]: value }));
  };

  // Pin/unpin a note (max 3 pinned)
  const handlePinNote = (id) => {
    const note = notes.find(n => n.id === id);
    if (!note.pinned && notes.filter(n => n.pinned).length >= MAX_PINNED) {
      alert('You can only pin up to 3 notes.');
      return;
    }
    setNotes(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));
  };

  // To-do list handlers for the selected note
  const handleAddTodo = () => {
    setEditBuffer(buf => ({
      ...buf,
      todos: [...(buf.todos || []), { id: generateId(), text: '', done: false }],
    }));
  };
  const handleTodoChange = (todoId, value) => {
    setEditBuffer(buf => ({
      ...buf,
      todos: (buf.todos || []).map(todo => todo.id === todoId ? { ...todo, text: value } : todo),
    }));
  };
  const handleTodoCheck = (todoId) => {
    setEditBuffer(buf => ({
      ...buf,
      todos: (buf.todos || []).map(todo => todo.id === todoId ? { ...todo, done: !todo.done } : todo),
    }));
  };
  const handleRemoveTodo = (todoId) => {
    setEditBuffer(buf => ({
      ...buf,
      todos: (buf.todos || []).filter(todo => todo.id !== todoId),
    }));
  };

  // Save changes from edit buffer to the selected note
  const handleSaveNote = () => {
    setNotes(notes.map(note =>
      note.id === selectedNoteId
        ? { ...note, ...editBuffer, todos: Array.isArray(editBuffer.todos) ? editBuffer.todos : [] }
        : note
    ));
  };

  // Delete a note
  const handleDeleteNote = id => {
    const note = notes.find(n => n.id === id);
    const confirmDelete = window.confirm(`Are you sure you want to delete the note "${note?.title || 'Untitled Note'}"? This action cannot be undone.`);
    if (!confirmDelete) return;
    const filtered = notes.filter(note => note.id !== id);
    setNotes(filtered);
    if (filtered.length > 0) {
      setSelectedNoteId(filtered[0].id);
    } else {
      setSelectedNoteId(null);
    }
  };

  // Summarize the selected note (temporarily disabled for GitHub Pages)
  const handleSummarize = async () => {
    if (!selectedNote || !editBuffer.content.trim()) return;
    setLoading(true);
    try {
      // Temporarily disabled for GitHub Pages deployment
      // TODO: Implement backend server for OpenAI integration
      setNotes(notes.map(note =>
        note.id === selectedNoteId ? { ...note, summary: 'Summarize feature temporarily disabled for deployment. Will be restored with backend integration.' } : note
      ));
    } catch (err) {
      setNotes(notes.map(note =>
        note.id === selectedNoteId ? { ...note, summary: 'Summarize feature unavailable.' } : note
      ));
    } finally {
      setLoading(false);
    }
  };

  // Archive/unarchive a note
  const handleArchiveNote = (id, value) => {
    setNotes(notes.map(note =>
      note.id === id ? { ...note, archived: value } : note
    ));
    if (value && selectedNoteId === id) {
      // If archiving the current note, select another
      const visibleNotes = notes.filter(n => n.id !== id && !n.archived);
      setSelectedNoteId(visibleNotes.length > 0 ? visibleNotes[0].id : null);
    }
  };

  // Sort notes: pinned first, then by date
  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.date) - new Date(a.date);
  });
  const visibleNotes = sortedNotes.filter(note => showArchived ? note.archived : !note.archived);

  // --- AUTH LOGIC ---
  const handleLogin = (email, password) => {
    if (!email || !password) {
      setAuthError('Please enter email and password.');
      return;
    }
    setAuth({ email, isGuest: false });
    setAuthError('');
  };
  const handleSignup = (email, password, confirm) => {
    if (!email || !password || !confirm) {
      setAuthError('Please fill all fields.');
      return;
    }
    if (password !== confirm) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuth({ email, isGuest: false });
    setAuthError('');
  };
  const handleGuest = () => {
    setAuth({ email: 'guest@example.com', isGuest: true });
    setAuthError('');
  };
  const handleLogout = () => {
    setAuth(null);
    setNotes([]);
    setSelectedNoteId(null);
  };

  // --- RENDER ---
  if (!auth) {
    return (
      <div className={`auth-container ${darkMode ? 'dark' : ''}`}>
        <div className="auth-box">
          <h1>AI Notes App</h1>
          {authMode === 'login' ? (
            <AuthLogin
              onLogin={handleLogin}
              onGuest={handleGuest}
              switchToSignup={() => setAuthMode('signup')}
            />
          ) : (
            <AuthSignup
              onSignup={handleSignup}
              switchToLogin={() => setAuthMode('login')}
            />
          )}
          {authError && <div className="auth-error">{authError}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${darkMode ? 'dark' : ''}`}>
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1>AI Notes App</h1>
        </div>
        <div className="header-right">
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="main-content">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="sidebar">
            <div className="sidebar-header">
              <button className="new-note-btn" onClick={handleNewNote}>
                + New Note
              </button>
              <div className="archive-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show Archived
                </label>
              </div>
            </div>
            <div className="notes-list">
              {visibleNotes.length === 0 ? (
                <div className="empty-state">
                  <p>No notes yet.</p>
                  <button onClick={handleNewNote}>Create your first note</button>
                </div>
              ) : (
                visibleNotes.map(note => (
                  <div
                    key={note.id}
                    className={`note-item ${selectedNoteId === note.id ? 'selected' : ''} ${note.pinned ? 'pinned' : ''}`}
                    onClick={() => setSelectedNoteId(note.id)}
                  >
                    <div className="note-header">
                      <h3>{note.title}</h3>
                      <div className="note-actions">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePinNote(note.id);
                          }}
                          className="pin-btn"
                        >
                          {note.pinned ? '📌' : '📍'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveNote(note.id, !note.archived);
                          }}
                          className="archive-btn"
                        >
                          {note.archived ? '📂' : '📁'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNote(note.id);
                          }}
                          className="delete-btn"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <p className="note-preview">
                      {note.content.substring(0, 100)}
                      {note.content.length > 100 && '...'}
                    </p>
                    <div className="note-meta">
                      <span className="note-date">
                        {new Date(note.date).toLocaleDateString()}
                      </span>
                      {note.todos && note.todos.length > 0 && (
                        <span className="todo-count">
                          📋 {note.todos.filter(t => t.done).length}/{note.todos.length}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        {/* Main Editor */}
        <main className="editor">
          {selectedNote ? (
            <div className="editor-content">
              <div className="editor-header">
                <input
                  type="text"
                  value={editBuffer.title}
                  onChange={(e) => handleEditBufferChange('title', e.target.value)}
                  className="title-input"
                  placeholder="Note title..."
                />
                <div className="editor-actions">
                  <button
                    onClick={handleSummarize}
                    disabled={loading || !editBuffer.content.trim()}
                    className="summarize-btn"
                  >
                    {loading ? 'Summarizing...' : '📝 Summarize'}
                  </button>
                  <button onClick={handleSaveNote} className="save-btn">
                    💾 Save
                  </button>
                </div>
              </div>
              
              <textarea
                value={editBuffer.content}
                onChange={(e) => handleEditBufferChange('content', e.target.value)}
                className="content-textarea"
                placeholder="Start writing your note..."
              />
              
              {/* Todo List */}
              <div className="todo-section">
                <div className="todo-header">
                  <h3>📋 To-Do List</h3>
                  <button onClick={handleAddTodo} className="add-todo-btn">
                    + Add Todo
                  </button>
                </div>
                <div className="todo-list">
                  {editBuffer.todos && editBuffer.todos.map(todo => (
                    <div key={todo.id} className="todo-item">
                      <input
                        type="checkbox"
                        checked={todo.done}
                        onChange={() => handleTodoCheck(todo.id)}
                      />
                      <input
                        type="text"
                        value={todo.text}
                        onChange={(e) => handleTodoChange(todo.id, e.target.value)}
                        className={todo.done ? 'completed' : ''}
                        placeholder="Add a todo item..."
                      />
                      <button
                        onClick={() => handleRemoveTodo(todo.id)}
                        className="remove-todo-btn"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {selectedNote.summary && (
                <div className="summary-section">
                  <h3>📝 Summary</h3>
                  <p>{selectedNote.summary}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-editor">
              <h2>Welcome to AI Notes App!</h2>
              <p>Select a note from the sidebar or create a new one to get started.</p>
              <button onClick={handleNewNote} className="new-note-btn">
                + Create New Note
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function AuthLogin({ onLogin, onGuest, switchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit">Login</button>
      <button type="button" onClick={onGuest}>Continue as Guest</button>
      <p>
        Don't have an account?{' '}
        <button type="button" onClick={switchToSignup}>
          Sign up
        </button>
      </p>
    </form>
  );
}

function AuthSignup({ onSignup, switchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSignup(email, password, confirm);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Confirm Password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />
      <button type="submit">Sign Up</button>
      <p>
        Already have an account?{' '}
        <button type="button" onClick={switchToLogin}>
          Login
        </button>
      </p>
    </form>
  );
}

export default App;
