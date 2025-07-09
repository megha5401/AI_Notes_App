import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
console.log("Loaded API Key:", process.env.REACT_APP_OPENAI_API_KEY);

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
  const NOTES_KEY = auth ? `notes_${auth.isGuest ? 'guest' : auth.email}` : 'notes_guest';
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem(NOTES_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [editBuffer, setEditBuffer] = useState({ title: '', content: '' });
  // Add archive toggle state
  const [showArchived, setShowArchived] = useState(false);
  // Add pin limit constant
  const MAX_PINNED = 3;

  // Load notes and dark mode from localStorage on mount
  useEffect(() => {
    const savedNotes = localStorage.getItem('notes');
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
      if (JSON.parse(savedNotes).length > 0) {
        setSelectedNoteId(JSON.parse(savedNotes)[0].id);
      }
    }
    const savedDark = localStorage.getItem('darkMode');
    if (savedDark === 'true') setDarkMode(true);
  }, []);

  // Save notes to localStorage when they change
  useEffect(() => {
    if (auth) localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes, auth]);

  // When user changes (login/logout), load their notes
  useEffect(() => {
    if (auth) {
      const saved = localStorage.getItem(NOTES_KEY);
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

  // Summarize the selected note
  const handleSummarize = async () => {
    if (!selectedNote || !editBuffer.content.trim()) return;
    setLoading(true);
    setNotes(notes.map(note =>
      note.id === selectedNoteId ? { ...note, summary: '' } : note
    ));
    try {
      const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a helpful assistant that summarizes notes.' },
            { role: 'user', content: `Summarize this note: ${editBuffer.content}` },
          ],
          max_tokens: 100,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );
      setNotes(notes.map(note =>
        note.id === selectedNoteId ? { ...note, summary: response.data.choices[0].message.content.trim() } : note
      ));
    } catch (err) {
      if (err.response && err.response.status === 429) {
        setNotes(notes.map(note =>
          note.id === selectedNoteId ? { ...note, summary: 'You have hit the OpenAI rate limit. Please wait and try again later.' } : note
        ));
      } else {
        setNotes(notes.map(note =>
          note.id === selectedNoteId ? { ...note, summary: 'Failed to summarize. Please check your API key and network.' } : note
        ));
      }
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
    // For demo: accept any email/password, or guest
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
    setAuth({ email: 'Guest', isGuest: true });
    setAuthError('');
  };
  const handleLogout = () => {
    setAuth(null);
  };

  // --- AUTH UI ---
  if (!auth) {
    return (
      <div className="auth-bg">
        <div className="auth-box">
          <h2 style={{ marginBottom: 18 }}>{authMode === 'login' ? 'Login' : 'Sign Up'}</h2>
          {authError && <div className="auth-error">{authError}</div>}
          {authMode === 'login' ? (
            <AuthLogin onLogin={handleLogin} onGuest={handleGuest} switchToSignup={() => { setAuthMode('signup'); setAuthError(''); }} />
          ) : (
            <AuthSignup onSignup={handleSignup} switchToLogin={() => { setAuthMode('login'); setAuthError(''); }} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`App${darkMode ? ' dark' : ''}`}>
      <h1 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 900 }}>
        <span>Welcome, {auth.isGuest ? 'Guest' : auth.email}</span>
        <button
          onClick={handleLogout}
          style={{
            background: darkMode ? '#222' : '#f1f5fa',
            color: darkMode ? '#fff' : '#222',
            border: 'none',
            borderRadius: 20,
            padding: '6px 18px',
            fontSize: '1rem',
            cursor: 'pointer',
            marginLeft: 12,
            transition: 'background 0.2s',
          }}
          title="Logout"
        >
          Logout
        </button>
      </h1>
      <div className="app-main">
        {/* Sidebar for Notes List */}
        <div className={`sidebar${sidebarOpen ? '' : ' closed'}`} style={{ left: sidebarOpen ? 0 : -300 }}>
          <button className="new-note-btn" onClick={handleNewNote}>+ New Note</button>
          <button
            className="sidebar-toggle-btn"
            style={{ marginBottom: 10 }}
            onClick={() => setShowArchived(a => !a)}
            title={showArchived ? 'Show Active Notes' : 'Show Archived Notes'}
          >
            {showArchived ? 'Show Active Notes' : 'Show Archived Notes'}
          </button>
          <div className="notes-list">
            {visibleNotes.map(note => (
              <div className={`note-list-item${note.pinned ? ' pinned' : ''}`} key={note.id}>
                <button
                  className={`note-list-btn${note.id === selectedNoteId ? ' selected' : ''}`}
                  onClick={() => setSelectedNoteId(note.id)}
                  tabIndex={0}
                  style={note.pinned ? { borderLeft: '4px solid #f59e42', background: darkMode ? '#23272f' : '#fffbe6' } : {}}
                >
                  {note.pinned && <span style={{ color: '#f59e42', marginRight: 6 }}>📌</span>}
                  <span style={{ fontWeight: 500 }}>{note.title || 'Untitled Note'}</span>
                  <br />
                  <span style={{ fontSize: 12, color: '#888' }}>{new Date(note.date).toLocaleString()}</span>
                </button>
                <button
                  className="delete-note-btn"
                  onClick={() => handleDeleteNote(note.id)}
                  title="Delete Note"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={() => setSidebarOpen(open => !open)}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? '← Hide' : '→ Show'}
          </button>
        </div>
        {/* Main Editor Area */}
        <div className="editor-area">
          {!sidebarOpen && (
            <button
              className="sidebar-toggle-btn floating"
              onClick={() => setSidebarOpen(true)}
              title="Show sidebar"
            >
              ☰ Notes
            </button>
          )}
          {selectedNote ? (
            <>
              <input
                className="note-title-input"
                value={editBuffer.title}
                onChange={e => handleEditBufferChange('title', e.target.value)}
                placeholder="Note Title"
              />
              <textarea
                className="note-input"
                value={editBuffer.content}
                onChange={e => handleEditBufferChange('content', e.target.value)}
                placeholder="Write your note here..."
                rows={8}
              />
              <div className="summary-box" style={{ margin: '18px 0', background: darkMode ? '#23272f' : '#f8fafc', border: darkMode ? undefined : '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: '1.1rem', marginRight: 10 }}>To-Do List</span>
                  <button className="summarize-btn" style={{ background: '#f59e42', color: '#fff', padding: '4px 12px', fontSize: '0.95rem' }} onClick={handleAddTodo}>
                    + Add To-Do
                  </button>
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {(editBuffer.todos || []).map(todo => (
                    <li key={todo.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                      <input type="checkbox" checked={todo.done} onChange={() => handleTodoCheck(todo.id)} style={{ marginRight: 8 }} />
                      <input
                        type="text"
                        value={todo.text}
                        onChange={e => handleTodoChange(todo.id, e.target.value)}
                        placeholder="To-do item..."
                        style={{ flex: 1, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: darkMode ? '#23272f' : '#fff', color: darkMode ? '#e5e7eb' : '#222' }}
                      />
                      <button
                        className="delete-note-btn"
                        style={{ marginLeft: 6 }}
                        onClick={() => handleRemoveTodo(todo.id)}
                        title="Remove To-Do"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button className="summarize-btn" onClick={handleSummarize} disabled={loading || !editBuffer.content.trim()}>
                  {loading ? 'Summarizing...' : 'Summarize Note'}
                </button>
                <button className="summarize-btn" style={{ background: '#10b981' }} onClick={handleSaveNote}>
                  Save Note
                </button>
                <button
                  className="summarize-btn"
                  style={{ background: '#6366f1' }}
                  onClick={() => handleArchiveNote(selectedNoteId, !selectedNote.archived)}
                >
                  {selectedNote.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  className="summarize-btn"
                  style={{ background: selectedNote.pinned ? '#f59e42' : '#e5e7eb', color: selectedNote.pinned ? '#fff' : '#222' }}
                  onClick={() => handlePinNote(selectedNoteId)}
                  disabled={!selectedNote.pinned && notes.filter(n => n.pinned).length >= MAX_PINNED}
                  title={selectedNote.pinned ? 'Unpin Note' : 'Pin Note'}
                >
                  {selectedNote.pinned ? 'Unpin 📌' : 'Pin 📌'}
                </button>
              </div>
              {selectedNote.summary && (
                <div className="summary-box" style={{ background: darkMode ? '#23272f' : '#f8fafc', border: darkMode ? undefined : '1px solid #e5e7eb' }}>
                  <h2>Summary</h2>
                  <p>{selectedNote.summary}</p>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#888', marginTop: 40 }}>No note selected. Click "+ New Note" to create one.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuthLogin({ onLogin, onGuest, switchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); onLogin(email, password); }}>
      <input className="auth-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="auth-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button className="auth-btn" type="submit">Login</button>
      <button className="auth-btn" type="button" onClick={onGuest} style={{ background: '#10b981' }}>Continue as Guest</button>
      <div style={{ marginTop: 10 }}>
        <span>Don't have an account? </span>
        <button type="button" className="auth-link" onClick={switchToSignup}>Sign Up</button>
      </div>
    </form>
  );
}

function AuthSignup({ onSignup, switchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); onSignup(email, password, confirm); }}>
      <input className="auth-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="auth-input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <input className="auth-input" type="password" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} />
      <button className="auth-btn" type="submit">Sign Up</button>
      <div style={{ marginTop: 10 }}>
        <span>Already have an account? </span>
        <button type="button" className="auth-link" onClick={switchToLogin}>Login</button>
      </div>
    </form>
  );
}

export default App;
