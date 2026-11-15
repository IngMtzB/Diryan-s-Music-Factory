import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import SongStudio from './components/SongStudio';
import CreateProductionView from './components/CreateProductionView';
import SettingsModal from './components/SettingsModal';
import UploadAudioModal from './components/UploadAudioModal';
import RenderModal from './components/RenderModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import {
  fetchPlaylists,
  createPlaylist,
  renamePlaylist,
  deletePlaylist,
  moveProject,
  fetchProjects,
  fetchProject,
  createProject,
  updateSpec,
  deleteProject,
  uploadAudio,
  generateSpec,
  generateImage,
  fetchCatalog,
  updateCatalog,
} from './api';

export default function App() {
  const [playlists, setPlaylists] = useState([]);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null); // null = all, 'unclassified', or name

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');

  // Studio Catalog (visual creation_genres, creation_categories, and reusable genre_tags)
  const [catalog, setCatalog] = useState({
    genre_tags: [],
    creation_categories: [],
    creation_genres: [],
  });

  // Theme state ('dark' | 'light') + Epic Shockwave Ring state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('studio_theme') || 'dark';
  });
  const [shockwave, setShockwave] = useState(null); // { x, y, id, targetTheme }

  // Active opened project in studio view (null = dashboard view)
  const [currentProject, setCurrentProject] = useState(null);

  // Dedicated Page for "Nueva Producción" ("1. Selecciona Género & Sub-género Visual")
  const [isCreatingProduction, setIsCreatingProduction] = useState(false);

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [uploadAudioTarget, setUploadAudioTarget] = useState(null); // File object
  const [activeRenderJobId, setActiveRenderJobId] = useState(null);

  // Universal Delete Confirmation Modal Target
  // { type: 'project' | 'playlist', id: string, name: string }
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Sync theme class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('studio_theme', theme);
  }, [theme]);

  // Epic Dark <-> Light Mode Transition Handler
  const handleToggleTheme = useCallback(
    (event) => {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      const x =
        event?.clientX ??
        (typeof window !== 'undefined' ? window.innerWidth / 2 : 600);
      const y =
        event?.clientY ??
        (typeof window !== 'undefined' ? window.innerHeight / 2 : 400);

      const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      const root = document.documentElement;
      root.style.setProperty('--theme-x', `${x}px`);
      root.style.setProperty('--theme-y', `${y}px`);
      root.style.setProperty('--theme-r', `${endRadius}px`);

      // Trigger sonic shockwave ring
      const waveId = Date.now();
      setShockwave({ x, y, id: waveId, targetTheme: nextTheme });
      setTimeout(() => {
        setShockwave((prev) => (prev?.id === waveId ? null : prev));
      }, 950);

      if (document.startViewTransition) {
        document.startViewTransition(() => {
          if (nextTheme === 'dark') {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
          setTheme(nextTheme);
        });
      } else {
        setTheme(nextTheme);
      }
    },
    [theme]
  );

  // Synchronize state with URL parameters
  const updateUrl = (projectPath, playlistName, status, genre) => {
    const params = new URLSearchParams();
    if (projectPath) {
      params.set('project', projectPath);
    } else {
      if (playlistName) params.set('playlist', playlistName);
      if (status) params.set('status', status);
      if (genre) params.set('genre', genre);
    }
    const query = params.toString();
    const newUrl = query ? `/?${query}` : '/';
    if (window.location.search !== (query ? `?${query}` : '')) {
      window.history.pushState(
        { project: projectPath, playlist: playlistName, status, genre },
        '',
        newUrl
      );
    }
  };

  // Load studio catalog
  const loadCatalog = useCallback(async () => {
    try {
      const data = await fetchCatalog();
      setCatalog(data);
    } catch (err) {
      console.error('Error fetching studio catalog:', err);
    }
  }, []);

  const handleUpdateCatalog = async (nextCatalog) => {
    const saved = await updateCatalog(nextCatalog);
    setCatalog(saved);
    return saved;
  };

  const handleAddNewGenreTag = async (newTag) => {
    const clean = (newTag || '').trim();
    if (!clean) return;
    const existing = catalog?.genre_tags || [];
    if (existing.some((t) => t.toLowerCase() === clean.toLowerCase())) return;
    await handleUpdateCatalog({
      ...catalog,
      genre_tags: [...existing, clean],
    });
  };

  // Load playlists and stats
  const loadPlaylists = useCallback(async () => {
    try {
      const data = await fetchPlaylists();
      setPlaylists(data.playlists || []);
      setUnclassifiedCount(data.unclassified_count || 0);
      setTotalCount(data.total_projects || 0);
    } catch (err) {
      console.error('Error fetching playlists:', err);
    }
  }, []);

  // Load filtered projects
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProjects({
        playlist: selectedPlaylist,
        status: statusFilter,
        genre: genreFilter,
        q: searchQuery,
      });
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedPlaylist, statusFilter, genreFilter, searchQuery]);

  // Initial URL parsing and data loading
  useEffect(() => {
    loadCatalog();
    loadPlaylists();

    const params = new URLSearchParams(window.location.search);
    const initialProject = params.get('project');
    const initialPlaylist = params.get('playlist');
    const initialStatus = params.get('status');
    const initialGenre = params.get('genre');

    if (initialPlaylist) setSelectedPlaylist(initialPlaylist);
    if (initialStatus) setStatusFilter(initialStatus);
    if (initialGenre) setGenreFilter(initialGenre);

    if (initialProject) {
      fetchProject(initialProject)
        .then((proj) => setCurrentProject(proj))
        .catch((err) => {
          console.warn('Initial project not found:', err);
          updateUrl(null, initialPlaylist, initialStatus, initialGenre);
        });
    }
  }, [loadCatalog, loadPlaylists]);

  // Handle browser Back / Forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const projectParam = params.get('project');
      const playlistParam = params.get('playlist');
      const statusParam = params.get('status');
      const genreParam = params.get('genre');

      setSelectedPlaylist(playlistParam || null);
      setStatusFilter(statusParam || '');
      setGenreFilter(genreParam || '');
      setIsCreatingProduction(false);

      if (projectParam) {
        fetchProject(projectParam)
          .then((proj) => setCurrentProject(proj))
          .catch(() => setCurrentProject(null));
      } else {
        setCurrentProject(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Trigger project list update when filters change
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Refresh active project in studio
  const handleRefreshCurrentProject = async () => {
    if (!currentProject) return;
    try {
      const updated = await fetchProject(currentProject.rel_path);
      setCurrentProject(updated);
      loadProjects();
      loadPlaylists();
      loadCatalog();
    } catch (err) {
      console.error('Error refreshing project:', err);
    }
  };

  const handleOpenProject = async (proj) => {
    try {
      const full = await fetchProject(proj.rel_path);
      setIsCreatingProduction(false);
      setCurrentProject(full);
      updateUrl(proj.rel_path, selectedPlaylist, statusFilter, genreFilter);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentProject(null);
    setIsCreatingProduction(false);
    updateUrl(null, selectedPlaylist, statusFilter, genreFilter);
    loadProjects();
    loadPlaylists();
    loadCatalog();
  };

  const handleSelectPlaylist = (pl) => {
    setSelectedPlaylist(pl);
    setCurrentProject(null);
    setIsCreatingProduction(false);
    updateUrl(null, pl, statusFilter, genreFilter);
  };

  const handleSelectStatus = (status) => {
    setStatusFilter(status);
    updateUrl(null, selectedPlaylist, status, genreFilter);
  };

  const handleSelectGenre = (genre) => {
    setGenreFilter(genre);
    updateUrl(null, selectedPlaylist, statusFilter, genre);
  };

  const handleUpdateProjectGenreTags = async (relPath, nextTags) => {
    try {
      await updateSpec(relPath, { genre_tags: nextTags });
      await loadCatalog();
      await loadProjects();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreatePlaylist = async (name) => {
    try {
      await createPlaylist(name);
      await loadPlaylists();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRenamePlaylist = async (oldName, newName) => {
    try {
      await renamePlaylist(oldName, newName);
      if (selectedPlaylist === oldName) {
        setSelectedPlaylist(newName);
        updateUrl(null, newName, statusFilter, genreFilter);
      }
      await loadPlaylists();
      await loadProjects();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMoveProject = async (relPath, targetPlaylist) => {
    try {
      await moveProject(relPath, targetPlaylist);
      await loadPlaylists();
      await loadProjects();
      if (currentProject && currentProject.rel_path === relPath) {
        handleRefreshCurrentProject();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Universal Confirm Delete Handler
  const handleExecuteDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === 'project') {
      await deleteProject(deleteTarget.id);
      if (currentProject && currentProject.rel_path === deleteTarget.id) {
        handleBackToDashboard();
      }
    } else if (deleteTarget.type === 'playlist') {
      await deletePlaylist(deleteTarget.id);
      if (selectedPlaylist === deleteTarget.id) {
        setSelectedPlaylist(null);
        updateUrl(null, null, statusFilter, genreFilter);
      }
    }

    setDeleteTarget(null);
    await loadPlaylists();
    await loadProjects();
  };

  const handleCreateSong = async ({
    concept,
    style,
    playlist,
    provider,
    genre_tags,
    autoGenerate,
    signal,
  }) => {
    const created = await createProject({
      concept,
      style,
      playlist,
      provider,
      genre_tags,
      signal,
    });

    if (signal?.aborted) {
      await deleteProject(created.rel_path).catch(() => {});
      throw new DOMException('Aborted', 'AbortError');
    }

    if (autoGenerate) {
      let specRes = null;
      try {
        specRes = await generateSpec({
          relPath: created.rel_path,
          concept,
          style,
          provider,
          signal,
        });
      } catch (err) {
        await deleteProject(created.rel_path).catch(() => {});
        throw err;
      }

      if (signal?.aborted) {
        await deleteProject(created.rel_path).catch(() => {});
        throw new DOMException('Aborted', 'AbortError');
      }

      if (specRes?.spec?.image_prompt) {
        try {
          await generateImage({
            relPath: created.rel_path,
            prompt: specRes.spec.image_prompt,
            provider,
            signal,
          });
        } catch (imgErr) {
          if (imgErr.name === 'AbortError' || signal?.aborted) {
            await deleteProject(created.rel_path).catch(() => {});
            throw imgErr;
          }
          console.warn('Background image auto-generation warning:', imgErr);
        }
      }
    }

    await loadCatalog();
    await loadPlaylists();
    await loadProjects();

    // Open in studio & update URL
    const full = await fetchProject(created.rel_path);
    setIsCreatingProduction(false);
    setCurrentProject(full);
    updateUrl(created.rel_path, playlist, statusFilter, genreFilter);
  };

  const handleConfirmAudioUpload = async (file, options) => {
    if (!currentProject) return;
    await uploadAudio(currentProject.rel_path, file, options);
    await handleRefreshCurrentProject();
  };

  // Compute view header title
  let viewTitle = 'Todas las canciones';
  if (selectedPlaylist === 'unclassified') {
    viewTitle = 'Canciones sin Playlist';
  } else if (selectedPlaylist) {
    viewTitle = `Playlist: ${selectedPlaylist.replace(/_/g, ' ')}`;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-on-surface font-body-md antialiased relative">
      {/* Epic Theme Transition Sonic Shockwave Ring */}
      {shockwave && (
        <div className="fixed inset-0 pointer-events-none z-[10000] overflow-hidden">
          <div
            style={{
              left: `${shockwave.x}px`,
              top: `${shockwave.y}px`,
              transform: 'translate(-50%, -50%)',
            }}
            className={`absolute rounded-full border animate-sonic-shockwave ${
              shockwave.targetTheme === 'light'
                ? 'border-[#00e0ff] shadow-[0_0_80px_#00e0ff,inset_0_0_60px_#fec42e]'
                : 'border-[#00e0ff] shadow-[0_0_90px_#00e0ff,inset_0_0_70px_#006877]'
            }`}
          />
        </div>
      )}

      {/* Left Sidebar */}
      <Sidebar
        playlists={playlists}
        unclassifiedCount={unclassifiedCount}
        totalCount={totalCount}
        selectedPlaylist={selectedPlaylist}
        onSelectPlaylist={handleSelectPlaylist}
        onCreatePlaylist={handleCreatePlaylist}
        onRenamePlaylist={handleRenamePlaylist}
        onOpenSettings={() => setIsSettingsOpen(true)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onPromptDeletePlaylist={(pl) => {
          setDeleteTarget({
            type: 'playlist',
            id: pl.name,
            name: pl.name.replace(/_/g, ' '),
            description: `Se eliminará la playlist "${pl.name.replace(/_/g, ' ')}". Las canciones dentro de esta playlist NO se borrarán; serán movidas a Sin Playlist (Raíz).`,
          });
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {isCreatingProduction ? (
          <CreateProductionView
            playlists={playlists}
            initialPlaylist={
              selectedPlaylist && selectedPlaylist !== 'unclassified'
                ? selectedPlaylist
                : null
            }
            catalog={catalog}
            onUpdateCatalog={handleUpdateCatalog}
            onCancel={() => setIsCreatingProduction(false)}
            onCreate={handleCreateSong}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : currentProject ? (
          <SongStudio
            project={currentProject}
            playlists={playlists}
            catalog={catalog}
            onUpdateCatalog={handleUpdateCatalog}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onBack={handleBackToDashboard}
            onMovePlaylist={handleMoveProject}
            onOpenUploadAudio={(file) => setUploadAudioTarget(file)}
            onTriggerRenderModal={(jobId) => setActiveRenderJobId(jobId)}
            onRefreshProject={handleRefreshCurrentProject}
          />
        ) : (
          <div className="flex-1 min-h-0 flex flex-col h-full overflow-hidden animate-fade-scale">
            <Header
              title={viewTitle}
              subtitle={`${projects.length} producciones`}
              searchQuery={searchQuery}
              onSearchChange={(q) => setSearchQuery(q)}
              onOpenNewSong={() => setIsCreatingProduction(true)}
              theme={theme}
              onToggleTheme={handleToggleTheme}
            />

            <Dashboard
              projects={projects}
              playlists={playlists}
              loading={loading}
              statusFilter={statusFilter}
              onSelectStatus={handleSelectStatus}
              genreFilter={genreFilter}
              onSelectGenre={handleSelectGenre}
              availableGenreTags={catalog?.genre_tags || []}
              onAddNewGenreTag={handleAddNewGenreTag}
              onUpdateGenreTags={handleUpdateProjectGenreTags}
              onOpenProject={handleOpenProject}
              onMovePlaylist={handleMoveProject}
              onDeleteProject={(relPath) => {
                const found = projects.find((p) => p.rel_path === relPath);
                setDeleteTarget({
                  type: 'project',
                  id: relPath,
                  name: found?.title || relPath,
                  description: `Se borrará permanentemente la canción "${found?.title || relPath}" y todos sus archivos asociados (audio, fondo, videos y letras).`,
                });
              }}
              onNewSong={() => setIsCreatingProduction(true)}
            />
          </div>
        )}
      </div>

      {/* Studio Settings & Genre Catalog Manager Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        catalog={catalog}
        onUpdateCatalog={handleUpdateCatalog}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Upload Audio Confirmation Modal */}
      <UploadAudioModal
        isOpen={Boolean(uploadAudioTarget)}
        onClose={() => setUploadAudioTarget(null)}
        file={uploadAudioTarget}
        projectTitle={currentProject?.title}
        onConfirmUpload={handleConfirmAudioUpload}
      />

      {/* Real-time Render Progress Modal */}
      <RenderModal
        isOpen={Boolean(activeRenderJobId)}
        jobId={activeRenderJobId}
        onComplete={() => {
          handleRefreshCurrentProject();
        }}
        onClose={() => setActiveRenderJobId(null)}
      />

      {/* Universal Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleExecuteDelete}
        title={
          deleteTarget
            ? `¿Eliminar ${deleteTarget.type === 'playlist' ? 'playlist' : 'canción'} "${deleteTarget.name}"?`
            : '¿Confirmar eliminación?'
        }
        description={deleteTarget?.description}
        confirmWord="Eliminar"
      />
    </div>
  );
}
