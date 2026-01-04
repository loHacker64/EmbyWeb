import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Play, Info, ChevronLeft, ChevronRight, LogOut, LayoutGrid, X, Star, Volume2, VolumeX, Maximize, Pause, RotateCcw, RotateCw, ChevronDown } from 'lucide-react';

const EMBY_SERVER = 'http://192.168.1.100:8096';
const API_KEY = '9d8b1d7f8e8a4ef488dff0a7e894b862';

export default function App() {
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [libraries, setLibraries] = useState([]);
  const [featuredItems, setFeaturedItems] = useState([]);
  const [continueWatching, setContinueWatching] = useState([]);
  const [movieLibrary, setMovieLibrary] = useState([]);
  const [seriesLibrary, setSeriesLibrary] = useState([]);
  const [currentHero, setCurrentHero] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [activeView, setActiveView] = useState('home');
  const [expandedOverview, setExpandedOverview] = useState(false);
  const [heroFade, setHeroFade] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [movieSortOrder, setMovieSortOrder] = useState('DateCreated');
  const [seriesSortOrder, setSeriesSortOrder] = useState('DateCreated');
  const [playingItem, setPlayingItem] = useState(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showSkipIndicator, setShowSkipIndicator] = useState(null);
  const [movieOffset, setMovieOffset] = useState(0);
  const [seriesOffset, setSeriesOffset] = useState(0);
  const [hasMoreMovies, setHasMoreMovies] = useState(true);
  const [hasMoreSeries, setHasMoreSeries] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const skipTimeoutRef = useRef(null);
  const movieGridRef = useRef(null);
  const seriesGridRef = useRef(null);

  useEffect(() => {
    if (featuredItems.length > 0) {
      const interval = setInterval(() => {
        setHeroFade(false);
        setTimeout(() => {
          setCurrentHero((prev) => (prev + 1) % featuredItems.length);
          setExpandedOverview(false);
          setHeroFade(true);
        }, 800);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [featuredItems.length]);

  useEffect(() => {
    if (user) loadHeroByView();
    // eslint-disable-next-line
  }, [activeView]);

  useEffect(() => {
    const handleScroll = () => {
      if (activeView === 'movies' && movieGridRef.current && hasMoreMovies && !loadingMore) {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 500) {
          loadMoreMovies();
        }
      }
      if (activeView === 'series' && seriesGridRef.current && hasMoreSeries && !loadingMore) {
        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        if (scrollTop + clientHeight >= scrollHeight - 500) {
          loadMoreSeries();
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
    // eslint-disable-next-line
  }, [activeView, hasMoreMovies, hasMoreSeries, loadingMore, movieOffset, seriesOffset]);

  const handleLogin = async () => {
    setLoginError('');
    try {
      const response = await fetch(`${EMBY_SERVER}/Users/AuthenticateByName`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Emby-Authorization': 'MediaBrowser Client="EmbyWeb", Device="Browser", DeviceId="web-client", Version="1.0.0"' },
        body: JSON.stringify({ Username: username, Pw: password }),
      });
      if (!response.ok) throw new Error('Login fallito');
      const data = await response.json();
      setUser(data);
      loadContent(data.AccessToken, data.User.Id);
    } catch (error) {
      setLoginError('Credenziali non valide.');
    }
  };

  const loadContent = async (token, userId) => {
    try {
      const h = { 'X-Emby-Token': token };
      const [lib, resume, movies, series, items] = await Promise.all([
        fetch(`${EMBY_SERVER}/Users/${userId}/Views?api_key=${API_KEY}`, {headers:h}).then(r=>r.json()),
        fetch(`${EMBY_SERVER}/Users/${userId}/Items/Resume?Limit=20&Recursive=true&Fields=Overview&MediaTypes=Video&api_key=${API_KEY}`, {headers:h}).then(r=>r.json()),
        fetch(`${EMBY_SERVER}/Users/${userId}/Items?StartIndex=0&Limit=50&Recursive=true&IncludeItemTypes=Movie&SortBy=DateCreated&SortOrder=Descending&Fields=Overview&api_key=${API_KEY}`, {headers:h}).then(r=>r.json()),
        fetch(`${EMBY_SERVER}/Users/${userId}/Items?StartIndex=0&Limit=50&Recursive=true&IncludeItemTypes=Series&SortBy=DateCreated&SortOrder=Descending&Fields=Overview&api_key=${API_KEY}`, {headers:h}).then(r=>r.json()),
        fetch(`${EMBY_SERVER}/Users/${userId}/Items?Limit=10&Recursive=true&IncludeItemTypes=Movie,Series&SortBy=Random&Fields=Overview&api_key=${API_KEY}`, {headers:h}).then(r=>r.json())
      ]);
      const filteredLibs = (lib.Items || []).filter(l => !['livetv','music','boxsets','playlists'].includes(l.CollectionType?.toLowerCase()));
      const seen = new Set();
      const filteredResume = (resume.Items || []).filter(item => {
        if (item.Type === 'Episode') {
          if (seen.has(item.SeriesId)) return false;
          seen.add(item.SeriesId);
        }
        return true;
      });
      setLibraries(filteredLibs);
      setFeaturedItems(items.Items || []);
      setContinueWatching(filteredResume);
      setMovieLibrary(movies.Items || []);
      setSeriesLibrary(series.Items || []);
      setMovieOffset(50);
      setSeriesOffset(50);
      setHasMoreMovies(movies.Items?.length === 50);
      setHasMoreSeries(series.Items?.length === 50);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const loadMoreMovies = useCallback(async () => {
    if (!user || loadingMore || !hasMoreMovies) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${EMBY_SERVER}/Users/${user.User.Id}/Items?StartIndex=${movieOffset}&Limit=50&Recursive=true&IncludeItemTypes=Movie&SortBy=${movieSortOrder}&SortOrder=Descending&Fields=Overview&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
      const data = await res.json();
      if (data.Items && data.Items.length > 0) {
        setMovieLibrary(prev => [...prev, ...data.Items]);
        setMovieOffset(prev => prev + 50);
        setHasMoreMovies(data.Items.length === 50);
      } else {
        setHasMoreMovies(false);
      }
    } catch (error) {
      console.error('Error loading more movies:', error);
    }
    setLoadingMore(false);
  }, [user, movieOffset, movieSortOrder, loadingMore, hasMoreMovies]);

  const loadMoreSeries = useCallback(async () => {
    if (!user || loadingMore || !hasMoreSeries) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${EMBY_SERVER}/Users/${user.User.Id}/Items?StartIndex=${seriesOffset}&Limit=50&Recursive=true&IncludeItemTypes=Series&SortBy=${seriesSortOrder}&SortOrder=Descending&Fields=Overview&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
      const data = await res.json();
      if (data.Items && data.Items.length > 0) {
        setSeriesLibrary(prev => [...prev, ...data.Items]);
        setSeriesOffset(prev => prev + 50);
        setHasMoreSeries(data.Items.length === 50);
      } else {
        setHasMoreSeries(false);
      }
    } catch (error) {
      console.error('Error loading more series:', error);
    }
    setLoadingMore(false);
  }, [user, seriesOffset, seriesSortOrder, loadingMore, hasMoreSeries]);

  const loadHeroByView = async () => {
    if (!user) return;
    const type = activeView === 'movies' ? 'Movie' : activeView === 'series' ? 'Series' : 'Movie,Series';
    const res = await fetch(`${EMBY_SERVER}/Users/${user.User.Id}/Items?Limit=10&Recursive=true&IncludeItemTypes=${type}&SortBy=Random&Fields=Overview&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
    const data = await res.json();
    setFeaturedItems(data.Items || []);
    setCurrentHero(0);
  };

  const loadMoviesSort = async (sort) => {
    setMovieSortOrder(sort);
    if (!user) return;
    const res = await fetch(`${EMBY_SERVER}/Users/${user.User.Id}/Items?StartIndex=0&Limit=50&Recursive=true&IncludeItemTypes=Movie&SortBy=${sort}&SortOrder=Descending&Fields=Overview&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
    const data = await res.json();
    setMovieLibrary(data.Items || []);
    setMovieOffset(50);
    setHasMoreMovies(data.Items?.length === 50);
  };

  const loadSeriesSort = async (sort) => {
    setSeriesSortOrder(sort);
    if (!user) return;
    const res = await fetch(`${EMBY_SERVER}/Users/${user.User.Id}/Items?StartIndex=0&Limit=50&Recursive=true&IncludeItemTypes=Series&SortBy=${sort}&SortOrder=Descending&Fields=Overview&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
    const data = await res.json();
    setSeriesLibrary(data.Items || []);
    setSeriesOffset(50);
    setHasMoreSeries(data.Items?.length === 50);
  };

  const handleSearch = async (query) => {
    if (!query.trim() || !user) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`${EMBY_SERVER}/Users/${user.User.Id}/Items?SearchTerm=${encodeURIComponent(query)}&Recursive=true&IncludeItemTypes=Movie,Series&Fields=Overview&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
    const data = await res.json();
    setSearchResults(data.Items || []);
  };

  const closeSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearch(false);
  };

  const getImg = (item, type='Primary') => {
    if (!item.ImageTags?.[type]) return 'https://via.placeholder.com/300x450/1a1a1a/666?text=No+Image';
    return `${EMBY_SERVER}/Items/${item.Id}/Images/${type}?api_key=${API_KEY}`;
  };

  const getBackdrop = (item) => {
    if (!item.BackdropImageTags?.[0]) return null;
    return `${EMBY_SERVER}/Items/${item.Id}/Images/Backdrop?api_key=${API_KEY}`;
  };

  const openDetails = async (item) => {
    if (!user) return;
    setLoadingDetails(true);
    setSelectedItem(item);
    setItemDetails(null);
    setSeasons([]);
    setSelectedSeason(null);
    setEpisodes([]);
    closeSearch();
    
    const res = await fetch(`${EMBY_SERVER}/Users/${user.User.Id}/Items/${item.Id}?Fields=Overview,People,Genres,CommunityRating,OfficialRating,ProductionYear&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
    const details = await res.json();
    setItemDetails(details);
    
    if (details.Type === 'Series') {
      const sRes = await fetch(`${EMBY_SERVER}/Shows/${item.Id}/Seasons?userId=${user.User.Id}&Fields=Overview&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
      if (sRes.ok) {
        const sData = await sRes.json();
        const seasonsList = sData.Items || [];
        setSeasons(seasonsList);
        if (seasonsList.length > 0) {
          setSelectedSeason(seasonsList[0].Id);
          await loadEps(seasonsList[0].Id);
        }
      }
    }
    setLoadingDetails(false);
  };

  const loadEps = async (seasonId) => {
    if (!user) return;
    setSelectedSeason(seasonId);
    setEpisodes([]);
    
    try {
      const res = await fetch(`${EMBY_SERVER}/Shows/${seasonId}/Episodes?userId=${user.User.Id}&Fields=Overview&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
      if (res.ok) {
        const data = await res.json();
        setEpisodes(data.Items || []);
      }
    } catch (error) {
      console.error('Error loading episodes:', error);
    }
  };

  const closeModal = () => {
    setSelectedItem(null);
    setItemDetails(null);
    setSeasons([]);
    setSelectedSeason(null);
    setEpisodes([]);
  };

  const startPlay = (item) => {
    setPlayingItem(item);
    setIsPlaying(true);
  };

  const closePlayer = () => {
    setPlayingItem(null);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const skip = (sec) => {
    if (videoRef.current) {
      videoRef.current.currentTime += sec;
      setShowSkipIndicator(sec);
      if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
      skipTimeoutRef.current = setTimeout(() => setShowSkipIndicator(null), 2000);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolume = (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (videoRef.current) videoRef.current.volume = vol;
  };

  const toggleFull = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) document.exitFullscreen();
      else videoRef.current.requestFullscreen();
    }
  };

  const showCtrls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const formatTime = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    return `${m}:${s.toString().padStart(2,'0')}`;
  };

  const truncate = (text, limit=30) => {
    if (!text) return '';
    const words = text.split(' ');
    if (words.length <= limit) return text;
    return words.slice(0,limit).join(' ') + '...';
  };

  const scroll = (id, dir) => {
    const row = document.getElementById(id);
    if (row) row.scrollBy({left: dir === 'left' ? -1000 : 1000, behavior:'smooth'});
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-900 to-black flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
        <div className="relative z-10 bg-black/70 backdrop-blur-xl rounded-2xl p-8 w-full max-w-md border border-white/10 shadow-2xl">
          <h1 className="text-4xl font-bold text-white mb-2 text-center">Emby</h1>
          <p className="text-gray-400 text-center mb-8">Accedi al tuo account</p>
          <div className="space-y-6">
            <input type="text" placeholder="Nome utente" value={username} onChange={e=>setUsername(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleLogin()} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition" />
            <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleLogin()} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition" />
            {loginError && <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">{loginError}</div>}
            <button onClick={handleLogin} className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-semibold py-3 rounded-lg transition transform hover:scale-105 shadow-lg">Accedi</button>
            <div className="text-center text-sm text-gray-400 mt-4">Server: ilmioserver.diskstation.me</div>
          </div>
          <div className="absolute bottom-4 right-4 group">
            <div className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-help transition"><span className="text-white text-xs">?</span></div>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block"><div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg px-4 py-2 text-sm text-gray-300 whitespace-nowrap shadow-xl">Connesso a: {EMBY_SERVER}</div></div>
          </div>
        </div>
      </div>
    );
  }

  const curr = featuredItems[currentHero];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 via-black/70 to-transparent px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-3xl font-bold text-emerald-500">EMBY</h1>
            <nav className="flex gap-6">
              {['home','movies','series'].map(v=><button key={v} onClick={()=>{setActiveView(v);closeSearch();}} className={`text-base font-semibold transition px-3 py-2 rounded-lg ${activeView===v?'text-white bg-white/10':'text-gray-400 hover:text-white hover:bg-white/5'}`}>{v==='home'?'HOME':v==='movies'?'FILM':'SERIE TV'}</button>)}
            </nav>
          </div>
          <div className="flex-1 max-w-2xl mx-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="text" placeholder="Cerca film o serie TV..." value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);handleSearch(e.target.value);setShowSearch(e.target.value.length>0);}} className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-full pl-12 pr-12 py-3 text-white placeholder-gray-400 focus:outline-none focus:bg-white/20 focus:border-emerald-500 transition" />
              {searchQuery && (
                <button onClick={closeSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="http://192.168.1.100:8096" target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition"><LayoutGrid className="w-4 h-4" /><span className="text-sm">Versione classica</span></a>
            <button onClick={()=>setUser(null)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      {showSearch && searchResults.length>0 && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-40 w-full max-w-4xl mx-auto px-4">
          <div className="bg-gray-900/98 backdrop-blur-2xl rounded-2xl p-6 shadow-2xl border border-white/10 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Risultati ricerca ({searchResults.length})</h3>
              <button onClick={closeSearch} className="text-gray-400 hover:text-white transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {searchResults.map(item=><div key={item.Id} className="group cursor-pointer" onClick={()=>openDetails(item)}><img src={getImg(item)} alt={item.Name} className="w-full aspect-[2/3] object-cover rounded-lg group-hover:scale-105 group-hover:ring-2 group-hover:ring-emerald-500 transition shadow-xl"/><p className="text-sm mt-2 truncate text-center font-medium">{item.Name}</p><p className="text-xs text-gray-400 text-center">{item.Type==='Movie'?'Film':'Serie TV'}</p></div>)}
            </div>
          </div>
        </div>
      )}

      {curr && (
        <div className="relative h-[75vh]">
          <div className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ${heroFade?'opacity-100 scale-100':'opacity-0 scale-105'}`} style={{backgroundImage:`url(${getBackdrop(curr)||getImg(curr)})`}}>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
          </div>
          <div className={`relative h-full flex items-end px-8 md:px-16 pb-20 transition-all duration-1000 ${heroFade?'opacity-100 translate-y-0':'opacity-0 translate-y-4'}`}>
            <div className="max-w-3xl space-y-5">
              <h2 className="text-5xl md:text-7xl font-bold drop-shadow-2xl">{curr.Name}</h2>
              <div className="backdrop-blur-sm bg-black/30 rounded-xl p-4 inline-block">
                <p className="text-lg text-gray-200 leading-relaxed">{curr.Overview?(expandedOverview?curr.Overview:truncate(curr.Overview,35)):'Nessuna descrizione.'}</p>
                {curr.Overview && curr.Overview.split(' ').length>35 && <button onClick={()=>setExpandedOverview(!expandedOverview)} className="text-emerald-400 hover:text-emerald-300 text-sm mt-2 font-medium">{expandedOverview?'Mostra meno':'Continua a leggere...'}</button>}
              </div>
              <div className="flex gap-4 pt-2">
                <button onClick={()=>startPlay(curr)} className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105 shadow-2xl"><Play className="w-6 h-6 fill-current"/>Riproduci</button>
                <button onClick={()=>openDetails(curr)} className="flex items-center gap-3 bg-white/20 backdrop-blur-md hover:bg-white/30 px-10 py-4 rounded-xl font-semibold text-lg transition shadow-xl"><Info className="w-6 h-6"/>Più info</button>
              </div>
            </div>
          </div>
          <button onClick={()=>{setHeroFade(false);setTimeout(()=>{setCurrentHero((currentHero-1+featuredItems.length)%featuredItems.length);setExpandedOverview(false);setHeroFade(true);},800);}} className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-3 rounded-full transition backdrop-blur-sm"><ChevronLeft className="w-8 h-8"/></button>
          <button onClick={()=>{setHeroFade(false);setTimeout(()=>{setCurrentHero((currentHero+1)%featuredItems.length);setExpandedOverview(false);setHeroFade(true);},800);}} className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-3 rounded-full transition backdrop-blur-sm"><ChevronRight className="w-8 h-8"/></button>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
            {featuredItems.map((_,i)=><button key={i} onClick={()=>{setHeroFade(false);setTimeout(()=>{setCurrentHero(i);setExpandedOverview(false);setHeroFade(true);},800);}} className={`h-1 rounded-full transition-all duration-300 ${i===currentHero?'bg-emerald-500 w-12':'bg-white/50 w-8 hover:bg-white/70'}`}/>)}
          </div>
        </div>
      )}

      <div className="relative -mt-20 px-8 md:px-16 pb-16 space-y-16">
        {activeView==='home' && continueWatching.length>0 &&(
          <div className="pt-12">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2"><Play className="w-6 h-6 text-emerald-500"/>Continua a guardare</h3>
            <div className="relative group">
              <button onClick={()=>scroll('continue','left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition"><ChevronLeft className="w-6 h-6"/></button>
              <div id="continue" className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth">
                {continueWatching.map(item=>{
                  if(item.Type==='Episode'){
                    return <div key={item.Id} className="flex-none w-64 cursor-pointer" onClick={()=>startPlay(item)}>
                      <div className="relative">
                        <img src={`${EMBY_SERVER}/Items/${item.SeriesId}/Images/Primary?api_key=${API_KEY}`} alt={item.SeriesName} className="w-full aspect-video object-cover rounded-lg hover:scale-105 transition-transform duration-300 shadow-xl"/>
                        <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center rounded-lg"><div className="bg-emerald-600 rounded-full p-3"><Play className="w-6 h-6 fill-white"/></div></div>
                        {item.UserData?.PlayedPercentage && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-700 rounded-b-lg"><div className="h-full bg-emerald-500 rounded-bl-lg" style={{width:`${item.UserData.PlayedPercentage}%`}}></div></div>}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-center line-clamp-2">{item.SeriesName}</p>
                      <p className="text-xs text-gray-400 text-center">S{item.ParentIndexNumber} E{item.IndexNumber}</p>
                    </div>;
                  }
                  return <div key={item.Id} className="flex-none w-64 cursor-pointer" onClick={()=>startPlay(item)}>
                    <div className="relative">
                      <img src={getImg(item)} alt={item.Name} className="w-full aspect-video object-cover rounded-lg hover:scale-105 transition-transform duration-300 shadow-xl"/>
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center rounded-lg"><div className="bg-emerald-600 rounded-full p-3"><Play className="w-6 h-6 fill-white"/></div></div>
                      {item.UserData?.PlayedPercentage && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-700 rounded-b-lg"><div className="h-full bg-emerald-500 rounded-bl-lg" style={{width:`${item.UserData.PlayedPercentage}%`}}></div></div>}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-center line-clamp-2">{item.Name}</p>
                  </div>;
                })}
              </div>
              <button onClick={()=>scroll('continue','right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition"><ChevronRight className="w-6 h-6"/></button>
            </div>
          </div>
        )}

        {activeView==='home' && libraries.map(lib=>(
          <div key={lib.Id}>
            <h3 className="text-2xl font-bold mb-6">{lib.Name}</h3>
            <div className="relative group">
              <button onClick={()=>scroll(`row-${lib.Id}`,'left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition"><ChevronLeft className="w-6 h-6"/></button>
              <div id={`row-${lib.Id}`} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth">
                {(lib.CollectionType==='movies'?movieLibrary:lib.CollectionType==='tvshows'?seriesLibrary:featuredItems).slice(0,20).map(item=><div key={item.Id} className="flex-none w-48 cursor-pointer" onClick={()=>openDetails(item)}><img src={getImg(item)} alt={item.Name} className="w-full aspect-[2/3] object-cover rounded-lg hover:scale-110 transition-transform duration-500 shadow-xl"/><p className="mt-3 text-sm font-medium text-center line-clamp-2">{item.Name}</p></div>)}
              </div>
              <button onClick={()=>scroll(`row-${lib.Id}`,'right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition"><ChevronRight className="w-6 h-6"/></button>
            </div>
          </div>
        ))}

        {activeView==='movies' && (
          <div ref={movieGridRef}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-3xl font-bold">Film ({movieLibrary.length})</h3>
              <select value={movieSortOrder} onChange={e=>loadMoviesSort(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500">
                <option value="SortName" className="bg-gray-800 text-white">A-Z</option>
                <option value="DateCreated" className="bg-gray-800 text-white">Più recenti</option>
                <option value="PremiereDate" className="bg-gray-800 text-white">Data uscita</option>
                <option value="Random" className="bg-gray-800 text-white">Casuale</option>
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {movieLibrary.map(item=><div key={item.Id} className="cursor-pointer" onClick={()=>openDetails(item)}><img src={getImg(item)} alt={item.Name} className="w-full aspect-[2/3] object-cover rounded-lg hover:scale-110 transition-transform duration-500 shadow-xl"/><p className="mt-3 text-sm font-medium text-center line-clamp-2">{item.Name}</p></div>)}
            </div>
            {loadingMore && <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>}
            {!hasMoreMovies && movieLibrary.length > 0 && <div className="text-center py-8 text-gray-400">Tutti i film caricati</div>}
          </div>
        )}

        {activeView==='series' && (
          <div ref={seriesGridRef}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-3xl font-bold">Serie TV ({seriesLibrary.length})</h3>
              <select value={seriesSortOrder} onChange={e=>loadSeriesSort(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-emerald-500">
                <option value="SortName" className="bg-gray-800 text-white">A-Z</option>
                <option value="DateCreated" className="bg-gray-800 text-white">Più recenti</option>
                <option value="PremiereDate" className="bg-gray-800 text-white">Data uscita</option>
                <option value="Random" className="bg-gray-800 text-white">Casuale</option>
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {seriesLibrary.map(item=><div key={item.Id} className="cursor-pointer" onClick={()=>openDetails(item)}><img src={getImg(item)} alt={item.Name} className="w-full aspect-[2/3] object-cover rounded-lg hover:scale-110 transition-transform duration-500 shadow-xl"/><p className="mt-3 text-sm font-medium text-center line-clamp-2">{item.Name}</p></div>)}
            </div>
            {loadingMore && <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>}
            {!hasMoreSeries && seriesLibrary.length > 0 && <div className="text-center py-8 text-gray-400">Tutte le serie caricate</div>}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md"></div>
          <div className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10" onClick={e=>e.stopPropagation()}>
            <button onClick={closeModal} className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 rounded-full p-2 transition"><X className="w-6 h-6"/></button>
            {loadingDetails?<div className="flex items-center justify-center py-20"><div className="text-white text-lg">Caricamento...</div></div>:itemDetails?(
              <div className="grid md:grid-cols-2 gap-8 p-8">
                <div><img src={getImg(itemDetails)} alt={itemDetails.Name} className="w-full rounded-lg shadow-2xl"/></div>
                <div className="space-y-6">
                  <div>
                    <h2 className="text-4xl font-bold mb-2">{itemDetails.Name}</h2>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      {itemDetails.ProductionYear && <span>{itemDetails.ProductionYear}</span>}
                      {itemDetails.OfficialRating && <span className="px-2 py-1 border border-gray-600 rounded">{itemDetails.OfficialRating}</span>}
                      {itemDetails.CommunityRating && <span className="flex items-center gap-1"><Star className="w-4 h-4 fill-yellow-500 text-yellow-500"/>{itemDetails.CommunityRating.toFixed(1)}</span>}
                    </div>
                  </div>
                  <button onClick={()=>{closeModal();startPlay(itemDetails.Type==='Series'&&episodes.length>0?episodes[0]:itemDetails);}} className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition transform hover:scale-105 shadow-lg"><Play className="w-6 h-6 fill-current"/>Riproduci</button>
                  {itemDetails.Overview && <div><h3 className="text-xl font-semibold mb-2">Trama</h3><p className="text-gray-300 leading-relaxed">{itemDetails.Overview}</p></div>}
                  {itemDetails.Genres?.length>0 && <div><span className="text-gray-400">Generi: </span><span className="text-white">{itemDetails.Genres.join(', ')}</span></div>}
                  {itemDetails.People?.filter(p=>p.Type==='Actor').length>0 && <div><h3 className="text-xl font-semibold mb-3">Cast</h3><div className="flex flex-wrap gap-2">{itemDetails.People.filter(p=>p.Type==='Actor').slice(0,10).map(p=><span key={p.Id} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-sm text-gray-300 transition">{p.Name}</span>)}</div></div>}
                  {itemDetails.Type==='Series' && seasons.length>0 && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xl font-semibold mb-3">Stagione</label>
                        <div className="relative">
                          <select value={selectedSeason||''} onChange={e=>loadEps(e.target.value)} className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500 appearance-none">
                            {seasons.map(s=><option key={s.Id} value={s.Id} className="bg-gray-800 text-white">{s.Name}</option>)}
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"/>
                        </div>
                      </div>
                      {episodes.length>0 && (
                        <div>
                          <h3 className="text-xl font-semibold mb-4">Episodi ({episodes.length})</h3>
                          <div className="relative group">
                            <button onClick={()=>scroll(`eps-${selectedSeason}`,'left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition"><ChevronLeft className="w-6 h-6"/></button>
                            <div id={`eps-${selectedSeason}`} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth -mx-8 px-8">
                              {episodes.map(ep=><div key={ep.Id} className="flex-none w-80 bg-white/5 hover:bg-white/10 rounded-lg overflow-hidden transition cursor-pointer" onClick={()=>{closeModal();startPlay(ep);}}>
                                <div className="relative aspect-video bg-gray-800">
                                  {ep.ImageTags?.Primary?<img src={getImg(ep,'Primary')} alt={ep.Name} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"/>:<div className="w-full h-full flex items-center justify-center text-gray-500"><Play className="w-12 h-12"/></div>}
                                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition flex items-center justify-center"><div className="bg-emerald-600 rounded-full p-3 scale-75 hover:scale-100 transition"><Play className="w-6 h-6 fill-white"/></div></div>
                                </div>
                                <div className="p-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="text-emerald-500 font-semibold text-sm">Ep. {ep.IndexNumber}</span>
                                    {ep.RunTimeTicks && <span className="text-gray-500 text-xs">{Math.floor(ep.RunTimeTicks/600000000)} min</span>}
                                  </div>
                                  {ep.Name && <h4 className="text-white font-medium mb-2 line-clamp-1">{ep.Name}</h4>}
                                  {ep.Overview && <p className="text-gray-400 text-sm line-clamp-2">{ep.Overview}</p>}
                                </div>
                              </div>)}
                            </div>
                            <button onClick={()=>scroll(`eps-${selectedSeason}`,'right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/70 hover:bg-black/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition"><ChevronRight className="w-6 h-6"/></button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ):<div className="flex items-center justify-center py-20"><div className="text-white text-lg">Errore</div></div>}
          </div>
        </div>
      )}

      {playingItem && (
        <div className="fixed inset-0 z-[200] bg-black" onMouseMove={showCtrls}>
          <video ref={videoRef} className="w-full h-full" src={`${EMBY_SERVER}/Videos/${playingItem.Id}/stream?static=true&api_key=${API_KEY}`} autoPlay onClick={togglePlay} onTimeUpdate={()=>videoRef.current&&setCurrentTime(videoRef.current.currentTime)} onLoadedMetadata={()=>videoRef.current&&setDuration(videoRef.current.duration)} />
          {showSkipIndicator && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-black/80 backdrop-blur-xl rounded-full p-6 animate-pulse">
                {showSkipIndicator>0?<><RotateCw className="w-12 h-12 text-emerald-500"/><p className="text-white mt-2">+10s</p></>:<><RotateCcw className="w-12 h-12 text-emerald-500"/><p className="text-white mt-2">-10s</p></>}
              </div>
            </div>
          )}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/50 transition-opacity duration-300 ${showControls?'opacity-100':'opacity-0'}`}>
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
              <button onClick={closePlayer} className="bg-black/50 hover:bg-black/70 rounded-full p-2 backdrop-blur-sm transition"><X className="w-6 h-6"/></button>
              <h3 className="text-xl font-semibold">{playingItem.SeriesName||playingItem.Name}</h3>
              <div className="w-10"></div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4">
              <div className="w-full h-1 bg-gray-600 rounded-full cursor-pointer group" onClick={e=>{const rect=e.currentTarget.getBoundingClientRect();const x=e.clientX-rect.left;const pct=x/rect.width;if(videoRef.current)videoRef.current.currentTime=pct*duration;}}>
                <div className="h-full bg-emerald-500 rounded-full relative group-hover:h-2 transition-all" style={{width:`${(currentTime/duration)*100}%`}}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition"></div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={togglePlay} className="bg-white/20 hover:bg-white/30 rounded-full p-3 backdrop-blur-sm transition">{isPlaying?<Pause className="w-6 h-6"/>:<Play className="w-6 h-6 fill-current"/>}</button>
                  <button onClick={()=>skip(-10)} className="bg-white/20 hover:bg-white/30 rounded-full p-2 backdrop-blur-sm transition"><RotateCcw className="w-5 h-5"/></button>
                  <button onClick={()=>skip(10)} className="bg-white/20 hover:bg-white/30 rounded-full p-2 backdrop-blur-sm transition"><RotateCw className="w-5 h-5"/></button>
                  <div className="flex items-center gap-2">
                    <button onClick={toggleMute} className="text-white hover:text-emerald-500 transition">{isMuted?<VolumeX className="w-5 h-5"/>:<Volume2 className="w-5 h-5"/>}</button>
                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={handleVolume} className="w-20 accent-emerald-500"/>
                  </div>
                  <span className="text-sm text-gray-300">{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
                <button onClick={toggleFull} className="bg-white/20 hover:bg-white/30 rounded-full p-2 backdrop-blur-sm transition"><Maximize className="w-5 h-5"/></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}