import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import io from 'socket.io-client';

// Anslut till Socket.io-servern
const socket = io('https://kartquiz-server-production.up.railway.app');

// ÄNDRA DETTA LÖSENORD!
const HOST_PASSWORD = 'quiz2025';

// Custom marker icons
const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 3px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: white;
          border-radius: 50%;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
  });
};

const playerIcon = createCustomIcon('#FF6B35');
const correctIcon = createCustomIcon('#4ECDC4');

// Map click handler component
function MapClickHandler({ onMapClick, disabled }) {
  useMapEvents({
    click: (e) => {
      if (!disabled) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

// Map reset component
function MapReset({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

// Startsida
function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <h1 style={{
          fontSize: '48px',
          fontWeight: '800',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}>
          KartQuiz
        </h1>
        <p style={{
          color: '#64748b',
          fontSize: '18px',
          marginBottom: '40px',
          textAlign: 'center',
        }}>
          Gissa platser på kartan och tävla mot andra!
        </p>
        
        <Link to="/host" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            padding: '16px',
            fontSize: '18px',
            fontWeight: '600',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            marginBottom: '16px',
            transition: 'transform 0.2s',
          }}>
            🎯 Jag är Quiz Master (Host)
          </button>
        </Link>
        
        <Link to="/play" style={{ textDecoration: 'none' }}>
          <button style={{
            width: '100%',
            padding: '16px',
            fontSize: '18px',
            fontWeight: '600',
            background: '#4ECDC4',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
          }}>
            🎮 Jag vill spela!
          </button>
        </Link>
      </div>
    </div>
  );
}

// Host-sida (med lösenord)
function HostPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('menu'); // menu, create-quiz, manage-saved, host-game
  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [currentQuizId, setCurrentQuizId] = useState(null);
  
  const [roomCode, setRoomCode] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionNum, setCurrentQuestionNum] = useState(0);
  const [currentQuestionData, setCurrentQuestionData] = useState(null);
  const [showingResults, setShowingResults] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [guessCount, setGuessCount] = useState(0);
  const [players, setPlayers] = useState([]);
  
  const [newQuestion, setNewQuestion] = useState({
    text: '',
    imageUrl: '',
    audioUrl: '',
    correctLat: null,
    correctLng: null,
    maxDistance: 500,
    timeLimit: 0,
  });

  // Socket.io listeners
  useEffect(() => {
    socket.on('room-created', (data) => {
      if (data.success) {
        console.log('Rum skapat:', data.roomCode);
      }
    });

    socket.on('player-list-updated', (data) => {
      setPlayers(data.players);
    });

    socket.on('quiz-started', (data) => {
      setCurrentQuestionData(data);
      setCurrentQuestionNum(data.questionNumber);
      setShowingResults(false);
      setMode('host-game');
    });

    socket.on('guess-count-updated', (data) => {
      setGuessCount(data.guessCount);
    });

    socket.on('results-ready', (data) => {
      setResultsData(data);
      setShowingResults(true);
    });

    socket.on('next-question-ready', (data) => {
      setCurrentQuestionData(data);
      setCurrentQuestionNum(data.questionNumber);
      setShowingResults(false);
      setGuessCount(0);
    });

    socket.on('quiz-finished', (data) => {
      setResultsData(data);
    });

    socket.on('saved-quizzes-list', (data) => {
      setSavedQuizzes(data.quizzes);
    });

    socket.on('quiz-saved', (data) => {
      if (data.success) {
        alert('Quiz sparat!');
        socket.emit('get-saved-quizzes');
      }
    });

    socket.on('quiz-loaded', (data) => {
      if (data.success) {
        setQuizTitle(data.quiz.title);
        setQuestions(data.quiz.questions);
        alert(`Quiz "${data.quiz.title}" laddat!`);
      }
    });

    return () => {
      socket.off('room-created');
      socket.off('player-list-updated');
      socket.off('quiz-started');
      socket.off('guess-count-updated');
      socket.off('results-ready');
      socket.off('next-question-ready');
      socket.off('quiz-finished');
      socket.off('saved-quizzes-list');
      socket.off('quiz-saved');
      socket.off('quiz-loaded');
    };
  }, []);

  const handleLogin = () => {
    if (password === HOST_PASSWORD) {
      setIsAuthenticated(true);
      setError('');
      socket.emit('get-saved-quizzes');
    } else {
      setError('Fel lösenord!');
    }
  };

  const createNewQuiz = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    socket.emit('create-room', { 
      roomCode: code, 
      quizTitle: quizTitle || 'Mitt Quiz',
      hostName: 'Quiz Master'
    });
    setMode('create-quiz');
  };

  const addQuestion = () => {
    if (newQuestion.text && newQuestion.correctLat && newQuestion.correctLng) {
      setQuestions([...questions, { ...newQuestion, id: Date.now() }]);
      setNewQuestion({
        text: '',
        imageUrl: '',
        audioUrl: '',
        correctLat: null,
        correctLng: null,
        maxDistance: 500,
        timeLimit: 0,
      });
    }
  };

  const saveQuiz = () => {
    if (!quizTitle || questions.length === 0) {
      alert('Du måste ha en titel och minst en fråga!');
      return;
    }
    
    socket.emit('save-quiz', {
      id: currentQuizId || Date.now(),
      title: quizTitle,
      questions: questions
    });
    setCurrentQuizId(currentQuizId || Date.now());
  };

  const loadQuiz = (quizId) => {
    socket.emit('load-quiz', { id: quizId });
    setCurrentQuizId(quizId);
    setMode('create-quiz');
    // Skapa nytt rum när vi laddar ett sparat quiz
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    socket.emit('create-room', { 
      roomCode: code, 
      quizTitle: quizTitle || 'Mitt Quiz',
      hostName: 'Quiz Master'
    });
  };

  const deleteQuiz = (quizId) => {
    if (window.confirm('Är du säker på att du vill ta bort detta quiz?')) {
      socket.emit('delete-quiz', { id: quizId });
      setTimeout(() => socket.emit('get-saved-quizzes'), 100);
    }
  };

  const startQuiz = () => {
    if (questions.length > 0) {
      socket.emit('set-questions', { roomCode, questions });
      socket.emit('start-quiz', { roomCode });
    }
  };

  const showResults = () => {
    socket.emit('show-results', { roomCode });
  };

  const nextQuestion = () => {
    socket.emit('next-question', { roomCode });
  };

  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '48px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <h2 style={{
            fontSize: '32px',
            fontWeight: '700',
            marginBottom: '24px',
            color: '#1e293b',
          }}>
            🔐 Host-inloggning
          </h2>
          
          <input
            type="password"
            placeholder="Lösenord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              marginBottom: '16px',
              boxSizing: 'border-box',
            }}
          />
          
          {error && (
            <p style={{ color: '#ef4444', marginBottom: '16px' }}>{error}</p>
          )}
          
          <button
            onClick={handleLogin}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '18px',
              fontWeight: '600',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            Logga in
          </button>
          
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              background: 'transparent',
              color: '#64748b',
              border: 'none',
              cursor: 'pointer',
              marginTop: '16px',
            }}>
              ← Tillbaka
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '40px 20px',
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '700',
              marginBottom: '8px',
              color: '#1e293b',
            }}>
              Quiz Master Panel
            </h2>
            <p style={{ color: '#64748b', marginBottom: '24px' }}>
              Välkommen! Vad vill du göra?
            </p>
            
            <button
              onClick={createNewQuiz}
              style={{
                width: '100%',
                padding: '20px',
                fontSize: '18px',
                fontWeight: '600',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                marginBottom: '16px',
              }}
            >
              ➕ Skapa nytt quiz
            </button>
            
            <button
              onClick={() => setMode('manage-saved')}
              style={{
                width: '100%',
                padding: '20px',
                fontSize: '18px',
                fontWeight: '600',
                background: '#4ECDC4',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
              }}
            >
              📁 Hantera sparade quiz ({savedQuizzes.length})
            </button>
          </div>
          
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '12px 24px',
              fontSize: '16px',
              background: '#e2e8f0',
              color: '#64748b',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
            }}>
              ← Tillbaka till startsidan
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (mode === 'manage-saved') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '40px 20px',
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '700',
              marginBottom: '24px',
              color: '#1e293b',
            }}>
              📁 Sparade Quiz
            </h2>
            
            {savedQuizzes.length === 0 ? (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
                Inga sparade quiz än. Skapa ett nytt quiz och spara det!
              </p>
            ) : (
              savedQuizzes.map(quiz => (
                <div key={quiz.id} style={{
                  padding: '20px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <h3 style={{ color: '#1e293b', marginBottom: '8px' }}>
                      {quiz.title}
                    </h3>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>
                      {quiz.questions.length} frågor
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => loadQuiz(quiz.id)}
                      style={{
                        padding: '10px 20px',
                        background: '#4ECDC4',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      Ladda & Kör
                    </button>
                    <button
                      onClick={() => deleteQuiz(quiz.id)}
                      style={{
                        padding: '10px 20px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              ))
            )}
            
            <button
              onClick={() => setMode('menu')}
              style={{
                marginTop: '24px',
                padding: '12px 24px',
                background: '#e2e8f0',
                color: '#64748b',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              ← Tillbaka
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create-quiz') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f8fafc',
        padding: '40px 20px',
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '700',
              marginBottom: '8px',
              color: '#1e293b',
            }}>
              Skapa ditt Quiz
            </h2>
            <p style={{
              color: '#64748b',
              marginBottom: '24px',
            }}>
              Rumskod: <strong style={{ color: '#667eea', fontSize: '24px' }}>{roomCode}</strong>
            </p>
            
            <input
              type="text"
              placeholder="Quiz-titel"
              value={quizTitle}
              onChange={(e) => setQuizTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '18px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />
            
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px',
            }}>
              <button
                onClick={saveQuiz}
                style={{
                  padding: '12px 24px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                💾 Spara Quiz
              </button>
              
              <button
                onClick={() => setMode('menu')}
                style={{
                  padding: '12px 24px',
                  background: '#e2e8f0',
                  color: '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                ← Tillbaka till menyn
              </button>
            </div>
            
            <div style={{
              padding: '16px',
              background: '#f0f9ff',
              borderRadius: '12px',
              border: '2px solid #0ea5e9',
            }}>
              <p style={{ margin: 0, color: '#0c4a6e' }}>
                👥 <strong>{players.length}</strong> spelare i vänterummet
              </p>
            </div>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '24px',
            marginBottom: '24px',
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            }}>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '600',
                marginBottom: '20px',
                color: '#1e293b',
              }}>
                Lägg till fråga
              </h3>
              
              <input
                type="text"
                placeholder="Frågetext (t.ex. 'Var ligger Eiffeltornet?')"
                value={newQuestion.text}
                onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  boxSizing: 'border-box',
                }}
              />
              
              <input
                type="text"
                placeholder="Bild-URL (valfritt)"
                value={newQuestion.imageUrl}
                onChange={(e) => setNewQuestion({...newQuestion, imageUrl: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  boxSizing: 'border-box',
                }}
              />
              
              <input
                type="text"
                placeholder="Ljud-URL (valfritt, .mp3 .wav .ogg)"
                value={newQuestion.audioUrl}
                onChange={(e) => setNewQuestion({...newQuestion, audioUrl: e.target.value})}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="number"
                placeholder="Max avstånd för poäng (km)"
                value={newQuestion.maxDistance}
                onChange={(e) => setNewQuestion({...newQuestion, maxDistance: parseInt(e.target.value) || 500})}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  boxSizing: 'border-box',
                }}
              />
              
              <input
                type="number"
                placeholder="Tidsgräns (sekunder, 0 = ingen gräns)"
                value={newQuestion.timeLimit}
                onChange={(e) => setNewQuestion({...newQuestion, timeLimit: parseInt(e.target.value) || 0})}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  boxSizing: 'border-box',
                }}
              />
              
              <p style={{
                color: '#64748b',
                fontSize: '14px',
                marginBottom: '16px',
              }}>
                {newQuestion.correctLat && newQuestion.correctLng 
                  ? `✓ Plats markerad: ${newQuestion.correctLat.toFixed(4)}, ${newQuestion.correctLng.toFixed(4)}`
                  : 'Klicka på kartan för att markera rätt plats'}
              </p>
              
              <button
                onClick={addQuestion}
                disabled={!newQuestion.text || !newQuestion.correctLat}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '600',
                  background: (newQuestion.text && newQuestion.correctLat) ? '#4ECDC4' : '#cbd5e1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: (newQuestion.text && newQuestion.correctLat) ? 'pointer' : 'not-allowed',
                }}
              >
                Lägg till fråga
              </button>
            </div>
            
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              height: '500px',
            }}>
              <h4 style={{
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '16px',
                color: '#1e293b',
              }}>
                Markera rätt plats på kartan
              </h4>
              <div style={{ height: '430px', borderRadius: '12px', overflow: 'hidden' }}>
                <MapContainer
                  center={[59.3293, 18.0686]}
                  zoom={5}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapClickHandler
                    onMapClick={(latlng) => setNewQuestion({
                      ...newQuestion,
                      correctLat: latlng.lat,
                      correctLng: latlng.lng
                    })}
                    disabled={false}
                  />
                  {newQuestion.correctLat && newQuestion.correctLng && (
                    <Marker
                      position={[newQuestion.correctLat, newQuestion.correctLng]}
                      icon={correctIcon}
                    />
                  )}
                </MapContainer>
              </div>
            </div>
          </div>
          
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{
              fontSize: '24px',
              fontWeight: '600',
              marginBottom: '20px',
              color: '#1e293b',
            }}>
              Dina frågor ({questions.length})
            </h3>
            
            {questions.map((q, idx) => (
              <div key={q.id} style={{
                padding: '16px',
                background: '#f8fafc',
                borderRadius: '12px',
                marginBottom: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <strong style={{ color: '#1e293b' }}>#{idx + 1}:</strong> {q.text}
                  {q.imageUrl && <span style={{ color: '#4ECDC4', marginLeft: '12px' }}>🖼️</span>}
                  {q.audioUrl && <span style={{ color: '#4ECDC4', marginLeft: '12px' }}>🎵</span>}
                  <span style={{ color: '#64748b', marginLeft: '12px', fontSize: '14px' }}>
                    (Max {q.maxDistance} km{q.timeLimit > 0 && `, ⏱️ ${q.timeLimit}s`})
                  </span>
                </div>
                <button
                  onClick={() => setQuestions(questions.filter(qu => qu.id !== q.id))}
                  style={{
                    padding: '8px 16px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  Ta bort
                </button>
              </div>
            ))}
            
            {questions.length > 0 && (
              <button
                onClick={startQuiz}
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '18px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  marginTop: '24px',
                }}
              >
                🚀 Starta Quiz! ({players.length} spelare redo)
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'host-game') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f172a',
        color: 'white',
        padding: '20px',
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
          }}>
            <h2 style={{
              fontSize: '28px',
              fontWeight: '700',
            }}>
              Fråga {currentQuestionNum} av {questions.length}
            </h2>
            <div style={{
              fontSize: '18px',
              color: '#94a3b8',
            }}>
              Rumskod: <strong style={{ color: '#4ECDC4' }}>{roomCode}</strong>
            </div>
          </div>
          
          {!showingResults ? (
            <>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '32px',
                marginBottom: '24px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <h3 style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  marginBottom: '20px',
                }}>
                  {currentQuestionData?.text}
                </h3>
                
                {currentQuestionData?.imageUrl && (
                  <img
                    src={currentQuestionData.imageUrl}
                    alt="Ledtråd"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      borderRadius: '12px',
                      marginBottom: '20px',
                    }}
                  />
                )}
                
                <div style={{ marginBottom: '20px' }}>
                  <p style={{ fontSize: '18px', color: '#94a3b8' }}>
                    Spelare som gissat: <strong style={{ color: '#4ECDC4', fontSize: '24px' }}>{guessCount}/{players.length}</strong>
                  </p>
                </div>
                
                <button
                  onClick={showResults}
                  style={{
                    padding: '16px 32px',
                    fontSize: '18px',
                    fontWeight: '600',
                    background: '#4ECDC4',
                    color: '#0f172a',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Visa Resultat
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: '24px',
              }}>
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '24px',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  height: '600px',
                }}>
                  <h4 style={{
                    fontSize: '24px',
                    marginBottom: '16px',
                  }}>
                    Rätt svar & Spelargissningar
                  </h4>
                  <div style={{ height: '520px', borderRadius: '12px', overflow: 'hidden' }}>
                    <MapContainer
                      center={[resultsData.correctAnswer.lat, resultsData.correctAnswer.lng]}
                      zoom={6}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <MapReset center={[resultsData.correctAnswer.lat, resultsData.correctAnswer.lng]} zoom={6} />
                      <Marker
                        position={[resultsData.correctAnswer.lat, resultsData.correctAnswer.lng]}
                        icon={correctIcon}
                      >
                        <Popup>
                          <strong>Rätt svar</strong>
                        </Popup>
                      </Marker>
                      {resultsData.results.map((result) => (
                        <Marker
                          key={result.playerId}
                          position={[result.guess.lat, result.guess.lng]}
                          icon={createCustomIcon(result.playerColor)}
                        >
                          <Popup>
                            <strong>{result.playerName}</strong><br/>
                            {result.distance} km bort<br/>
                            +{result.points} poäng
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                </div>
                
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '16px',
                  padding: '24px',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <h4 style={{
                    fontSize: '24px',
                    marginBottom: '20px',
                  }}>
                    🏆 Leaderboard
                  </h4>
                  
                  {resultsData.results.map((result, idx) => (
                    <div
                      key={result.playerId}
                      style={{
                        padding: '16px',
                        background: idx === 0 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : 
                                   idx === 1 ? 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)' :
                                   idx === 2 ? 'linear-gradient(135deg, #CD7F32 0%, #B87333 100%)' :
                                   'rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        marginBottom: '12px',
                        color: idx < 3 ? '#0f172a' : 'white',
                        fontWeight: '600',
                        animation: `slideIn 0.4s ease-out ${idx * 0.1}s both`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '24px' }}>#{idx + 1}</span>
                          <span>{result.playerName}</span>
                        </div>
                        <span style={{ fontSize: '20px' }}>{result.totalScore}p</span>
                      </div>
                      <div style={{ fontSize: '14px', opacity: 0.8 }}>
                        {result.distance} km bort · +{result.points}p
                      </div>
                    </div>
                  ))}
                  
                  {currentQuestionNum < questions.length ? (
                    <button
                      onClick={nextQuestion}
                      style={{
                        width: '100%',
                        padding: '16px',
                        fontSize: '18px',
                        fontWeight: '600',
                        background: '#4ECDC4',
                        color: '#0f172a',
                        border: 'none',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        marginTop: '24px',
                      }}
                    >
                      Nästa Fråga →
                    </button>
                  ) : (
                    <div style={{
                      marginTop: '24px',
                      padding: '24px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '12px',
                      textAlign: 'center',
                    }}>
                      <h3 style={{ fontSize: '24px', marginBottom: '8px' }}>
                        🎉 Quiz Slut!
                      </h3>
                      <p style={{ fontSize: '18px' }}>
                        Vinnare: <strong>{resultsData.results[0]?.playerName}</strong>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        
        <style>{`
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
        `}</style>
      </div>
    );
  }

  return null;
}

// Spelare-sida
function PlayPage() {
  const navigate = useNavigate();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [mode, setMode] = useState('join'); // join, lobby, game
  const [currentQuestionData, setCurrentQuestionData] = useState(null);
  const [showingResults, setShowingResults] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myGuess, setMyGuess] = useState(null);
  const [hasGuessed, setHasGuessed] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    socket.on('join-success', (data) => {
      setPlayerId(data.playerId);
      setMode('lobby');
    });

    socket.on('join-error', (data) => {
      alert(data.message);
    });

    socket.on('player-list-updated', (data) => {
      setPlayers(data.players);
    });

    socket.on('quiz-started', (data) => {
      setCurrentQuestionData(data);
      setShowingResults(false);
      setMyGuess(null);
      setHasGuessed(false);
      setMode('game');
      setTimeLeft(data.timeLimit || null);
    });

    socket.on('guess-submitted', (data) => {
      if (data.success) {
        setHasGuessed(true);
      }
    });

    socket.on('results-ready', (data) => {
      setResultsData(data);
      setShowingResults(true);
      
      const myResult = data.results.find(r => r.playerId === playerId);
      if (myResult) {
        setMyScore(myResult.totalScore);
      }
    });

    socket.on('next-question-ready', (data) => {
      setCurrentQuestionData(data);
      setShowingResults(false);
      setMyGuess(null);
      setHasGuessed(false);
      setTimeLeft(data.timeLimit || null);
    });

    socket.on('quiz-finished', (data) => {
      setResultsData(data);
      setShowingResults(true);
    });

    socket.on('host-disconnected', () => {
      alert('Hosten har kopplat från. Quizet avslutas.');
      navigate('/');
    });

    return () => {
      socket.off('join-success');
      socket.off('join-error');
      socket.off('player-list-updated');
      socket.off('quiz-started');
      socket.off('guess-submitted');
      socket.off('results-ready');
      socket.off('next-question-ready');
      socket.off('quiz-finished');
      socket.off('host-disconnected');
    };
  }, [navigate, playerId]);

  // Timer för nedräkning
  useEffect(() => {
    if (timeLeft === null || timeLeft === 0 || showingResults || hasGuessed) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setHasGuessed(true); // Låser kartan när tiden tar slut
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, showingResults, hasGuessed]);

  const joinQuiz = () => {
    if (playerName && roomCode) {
      socket.emit('join-room', { 
        roomCode: roomCode.toUpperCase(), 
        playerName 
      });
    }
  };

  const makeGuess = (latlng) => {
    if (!hasGuessed && timeLeft !== 0) {
      setMyGuess(latlng);
    }
  };

  const submitGuess = () => {
    if (myGuess && !hasGuessed) {
      socket.emit('submit-guess', {
        roomCode,
        lat: myGuess.lat,
        lng: myGuess.lng
      });
    }
  };

  if (mode === 'join') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #4ECDC4 0%, #45B7D1 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '24px',
          padding: '48px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: '700',
            marginBottom: '24px',
            color: '#1e293b',
          }}>
            🎮 Gå med i Quiz
          </h2>
          
          <input
            type="text"
            placeholder="Ditt namn"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              marginBottom: '12px',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="text"
            placeholder="Rumskod"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '16px',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              marginBottom: '16px',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={joinQuiz}
            disabled={!playerName || !roomCode}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '18px',
              fontWeight: '600',
              background: (playerName && roomCode) ? '#4ECDC4' : '#cbd5e1',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: (playerName && roomCode) ? 'pointer' : 'not-allowed',
              marginBottom: '16px',
            }}
          >
            Gå med!
          </button>
          
          <Link to="/" style={{ textDecoration: 'none' }}>
            <button style={{
              width: '100%',
              padding: '12px',
              fontSize: '16px',
              background: 'transparent',
              color: '#64748b',
              border: 'none',
              cursor: 'pointer',
            }}>
              ← Tillbaka
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (mode === 'lobby') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#1e293b',
        color: 'white',
        padding: '20px',
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '24px',
          }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '700',
              marginBottom: '8px',
            }}>
              Välkommen, {playerName}!
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#94a3b8',
            }}>
              Rum: <strong style={{ color: '#4ECDC4', fontSize: '24px' }}>{roomCode}</strong>
            </p>
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '24px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
          }}>
            <h3 style={{
              fontSize: '28px',
              fontWeight: '700',
              marginBottom: '20px',
            }}>
              Väntar på quizstart...
            </h3>
            <p style={{
              fontSize: '18px',
              color: '#94a3b8',
              marginBottom: '24px',
            }}>
              Hosten sätter igång snart!
            </p>
            
            <div style={{
              display: 'inline-block',
              padding: '12px 24px',
              background: 'rgba(78, 205, 196, 0.2)',
              borderRadius: '12px',
              fontSize: '20px',
              fontWeight: '600',
            }}>
              {players.length} spelare i rummet
            </div>
          </div>
          
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '16px',
            padding: '24px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <h4 style={{
              fontSize: '20px',
              marginBottom: '16px',
            }}>
              👥 Spelare i rummet:
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: '12px',
            }}>
              {players.map(player => (
                <div key={player.id} style={{
                  padding: '12px',
                  background: 'rgba(78, 205, 196, 0.2)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  border: player.id === playerId ? '2px solid #4ECDC4' : 'none',
                }}>
                  {player.name}
                  {player.id === playerId && ' (Du)'}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'game') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#1e293b',
        color: 'white',
        padding: '20px',
      }}>
        <div style={{
          maxWidth: '900px',
          margin: '0 auto',
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '24px',
          }}>
            <h2 style={{
              fontSize: '32px',
              fontWeight: '700',
              marginBottom: '8px',
            }}>
              {playerName}
            </h2>
            <p style={{
              fontSize: '18px',
              color: '#94a3b8',
            }}>
              Poäng: <strong style={{ color: '#4ECDC4', fontSize: '24px' }}>{myScore}</strong>
            </p>
          </div>
          
          {!showingResults ? (
            <>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '32px',
                marginBottom: '24px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                textAlign: 'center',
              }}>
                <p style={{
                  fontSize: '16px',
                  color: '#94a3b8',
                  marginBottom: '12px',
                }}>
                  Fråga {currentQuestionData?.questionNumber} av {currentQuestionData?.totalQuestions}
                </p>
                
                {timeLeft !== null && timeLeft > 0 && (
                  <div style={{
                    marginBottom: '16px',
                  }}>
                    <div style={{
                      fontSize: '48px',
                      fontWeight: '800',
                      color: timeLeft <= 10 ? '#ef4444' : '#4ECDC4',
                      marginBottom: '8px',
                      animation: timeLeft <= 10 ? 'pulse 1s infinite' : 'none',
                    }}>
                      ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                    <div style={{
                      width: '100%',
                      height: '8px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${(timeLeft / (currentQuestionData?.timeLimit || 1)) * 100}%`,
                        height: '100%',
                        background: timeLeft <= 10 ? 'linear-gradient(90deg, #ef4444, #dc2626)' : 'linear-gradient(90deg, #4ECDC4, #45B7D1)',
                        transition: 'width 1s linear',
                      }}></div>
                    </div>
                  </div>
                )}
                
                {timeLeft === 0 && (
                  <div style={{
                    padding: '12px 24px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    borderRadius: '12px',
                    marginBottom: '16px',
                    fontSize: '18px',
                    fontWeight: '600',
                    color: '#ef4444',
                  }}>
                    ⏰ Tiden är ute!
                  </div>
                )}
                
                <h3 style={{
                  fontSize: '28px',
                  fontWeight: '700',
                  marginBottom: '20px',
                }}>
                  {currentQuestionData?.text}
                </h3>
                
                {currentQuestionData?.imageUrl && (
                  <img
                    src={currentQuestionData.imageUrl}
                    alt="Ledtråd"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      borderRadius: '12px',
                      marginBottom: '20px',
                    }}
                  />
                )}
                
                {currentQuestionData?.audioUrl && (
                  <div style={{
                    marginBottom: '20px',
                    padding: '16px',
                    background: 'rgba(78, 205, 196, 0.1)',
                    borderRadius: '12px',
                    border: '2px solid rgba(78, 205, 196, 0.3)',
                  }}>
                    <p style={{
                      marginBottom: '12px',
                      fontSize: '16px',
                      color: '#4ECDC4',
                      fontWeight: '600',
                    }}>
                      🎵 Lyssna på ljudet:
                    </p>
                    <audio controls autoPlay loop style={{ width: '100%', borderRadius: '8px' }}>
                      <source src={currentQuestionData.audioUrl} />
                      Din webbläsare stöder inte ljuduppspelning.
                    </audio>
                  </div>
                )}

                {hasGuessed ? (
                  <div style={{
                    padding: '16px',
                    background: 'rgba(78, 205, 196, 0.2)',
                    borderRadius: '12px',
                    fontSize: '18px',
                  }}>
                    ✓ Din gissning är inskickad! Väntar på andra...
                  </div>
                ) : myGuess ? (
                  <button
                    onClick={submitGuess}
                    style={{
                      padding: '16px 32px',
                      fontSize: '18px',
                      fontWeight: '600',
                      background: '#4ECDC4',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Skicka in gissning!
                  </button>
                ) : (
                  <p style={{
                    fontSize: '16px',
                    color: '#94a3b8',
                  }}>
                    Klicka på kartan nedan för att gissa!
                  </p>
                )}
              </div>
              
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                padding: '24px',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ height: '500px', borderRadius: '12px', overflow: 'hidden' }}>
                  <MapContainer
                    center={[20, 0]}
                    zoom={2}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapClickHandler
                      onMapClick={makeGuess}
                      disabled={hasGuessed}
                    />
                    {myGuess && (
                      <Marker
                        position={[myGuess.lat, myGuess.lng]}
                        icon={playerIcon}
                      />
                    )}
                  </MapContainer>
                </div>
                {myGuess && !hasGuessed && (
                  <p style={{
                    marginTop: '16px',
                    textAlign: 'center',
                    color: '#4ECDC4',
                  }}>
                    Din gissning är markerad! Klicka "Skicka in gissning" ovan.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '16px',
              padding: '32px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <h3 style={{
                fontSize: '28px',
                fontWeight: '700',
                marginBottom: '24px',
                textAlign: 'center',
              }}>
                Resultat
              </h3>
              
              {resultsData?.results.map((result, idx) => {
                const isMe = result.playerId === playerId;
                return (
                  <div
                    key={result.playerId}
                    style={{
                      padding: '16px',
                      background: isMe ? 'rgba(78, 205, 196, 0.3)' :
                                 idx === 0 ? 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)' : 
                                 idx === 1 ? 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)' :
                                 idx === 2 ? 'linear-gradient(135deg, #CD7F32 0%, #B87333 100%)' :
                                 'rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      marginBottom: '12px',
                      color: (idx < 3 && !isMe) ? '#0f172a' : 'white',
                      fontWeight: '600',
                      border: isMe ? '3px solid #4ECDC4' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '24px' }}>#{idx + 1}</span>
                        <span>{result.playerName} {isMe && '(Du)'}</span>
                      </div>
                      <span style={{ fontSize: '20px' }}>{result.totalScore}p</span>
                    </div>
                    <div style={{ fontSize: '14px', opacity: 0.8 }}>
                      {result.distance} km bort · +{result.points}p denna runda
                    </div>
                  </div>
                );
              })}
              
              <div style={{
                marginTop: '24px',
                padding: '16px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '12px',
                textAlign: 'center',
              }}>
                Väntar på nästa fråga...
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {null}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </>
  );
}

// Main App med Router
export default function App() {
  return (
    <div>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/host" element={<HostPage />} />
          <Route path="/play" element={<PlayPage />} />
        </Routes>
      </Router>
    </div>
  );
}
