import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Play, Info, ChevronLeft, ChevronRight, LogOut, X, Star, Volume2, VolumeX, Maximize, Pause, RotateCcw, RotateCw, ChevronDown, Languages, Subtitles, Home, Cloud, Settings } from 'lucide-react';
import Hls from 'hls.js';

const EMBY_SERVER = 'http://192.168.1.100:8096';
const API_KEY = '9d8b1d7f8e8a4ef488dff0a7e894b862';

// Genera UUID compatibile con tutti i browser
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Genera o recupera DeviceId persistente
const getDeviceId = () => {
  let deviceId = localStorage.getItem('emby_device_id');
  if (!deviceId) {
    deviceId = generateUUID();
    localStorage.setItem('emby_device_id', deviceId);
  }
  return deviceId;
};

// Genera nuovo PlaySessionId per ogni playback (senza trattini)
const generatePlaySessionId = () => {
  return generateUUID().replace(/-/g, '');
};

const DEVICE_ID = getDeviceId();

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
  const [searchExpanded, setSearchExpanded] = useState(false); // Per mobile: controlla se search bar è espansa
  const [activeView, setActiveView] = useState('home');
  const [expandedOverview, setExpandedOverview] = useState(false);
  const [heroFade, setHeroFade] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [seasons, setSeasons] = useState([]);

  // Rileva dispositivo mobile (solo phone, non tablet)
  // Phone: touch device CON schermo piccolo (<768px) → UI mobile
  // Tablet: touch device con schermo grande → UI desktop
  // REATTIVO: si aggiorna con resize/rotazione schermo
  const [isMobile, setIsMobile] = useState(() => {
    const isTouch = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 768;
    return isTouch && isSmallScreen; // Solo phone = mobile
  });
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [movieSortOrder, setMovieSortOrder] = useState('Random');
  const [seriesSortOrder, setSeriesSortOrder] = useState('Random');
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
  const [audioTracks, setAudioTracks] = useState([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState(null);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState([]);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState(null);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('auto'); // auto, 1080p, 720p, 480p, 360p
  const [mediaSourceId, setMediaSourceId] = useState(null);
  const [playSessionId, setPlaySessionId] = useState(null);
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [startTimeTicks, setStartTimeTicks] = useState(0); // Per seeking fluido e cambio traccia
  const videoRef = useRef(null);
  const hlsRef = useRef(null); // Hls.js instance
  const controlsTimeoutRef = useRef(null);
  const skipTimeoutRef = useRef(null);
  const movieGridRef = useRef(null);
  const seriesGridRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const seekToTimeRef = useRef(null);
  const streamStartTimeRef = useRef(0); // Traccia il tempo di inizio dello stream per il seeking

  useEffect(() => {
    if (featuredItems.length > 0) {
      const interval = setInterval(() => {
        setHeroFade(false);
        setTimeout(() => {
          setCurrentHero((prev) => (prev + 1) % featuredItems.length);
          setExpandedOverview(false);
          setHeroFade(true);
        }, 800);
      }, expandedOverview ? 12000 : 6000); // 12 secondi quando espanso, 6 secondi normale
      return () => clearInterval(interval);
    }
  }, [featuredItems.length, expandedOverview]);

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

  // CRITICO: Monitora resize/rotazione per aggiornare isMobile in tempo reale
  // Evita bug quando l'utente ruota il telefono da portrait (360px) a landscape (800px)
  useEffect(() => {
    const handleResize = () => {
      const isTouch = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isSmallScreen = window.innerWidth < 768;
      const shouldBeMobile = isTouch && isSmallScreen;

      if (shouldBeMobile !== isMobile) {
        setIsMobile(shouldBeMobile);
        // Chiudi search se passa da mobile a desktop
        if (!shouldBeMobile && searchExpanded) {
          setSearchQuery('');
          setSearchResults([]);
          setShowSearch(false);
          setSearchExpanded(false);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [isMobile, searchExpanded]);

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
    setSearchExpanded(false); // Chiudi anche l'espansione mobile
  };

  const getImg = (item, type='Primary') => {
    if (!item.ImageTags?.[type]) return 'https://via.placeholder.com/300x450/1a1a1a/666?text=No+Image';
    return `${EMBY_SERVER}/Items/${item.Id}/Images/${type}?api_key=${API_KEY}`;
  };

  const getBackdrop = (item) => {
    if (!item.BackdropImageTags?.[0]) return null;
    return `${EMBY_SERVER}/Items/${item.Id}/Images/Backdrop?api_key=${API_KEY}`;
  };

  const getHorizontalImg = (item) => {
    // For episodes, use the SERIES cover (16:9 format), not episode cover
    if (item.Type === 'Episode' && item.SeriesId) {
      // Use series Thumb (16:9) or Backdrop as fallback
      return `${EMBY_SERVER}/Items/${item.SeriesId}/Images/Thumb?maxWidth=480&maxHeight=270&quality=90&api_key=${API_KEY}`;
    }
    // Try Thumb first (16:9 format)
    if (item.ImageTags?.Thumb) {
      return `${EMBY_SERVER}/Items/${item.Id}/Images/Thumb?maxWidth=480&maxHeight=270&quality=90&api_key=${API_KEY}`;
    }
    // Try Backdrop
    if (item.BackdropImageTags?.[0]) {
      return `${EMBY_SERVER}/Items/${item.Id}/Images/Backdrop/0?maxWidth=480&maxHeight=270&quality=90&api_key=${API_KEY}`;
    }
    // Fallback to Primary with horizontal crop
    if (item.ImageTags?.Primary) {
      return `${EMBY_SERVER}/Items/${item.Id}/Images/Primary?maxWidth=480&maxHeight=270&quality=90&api_key=${API_KEY}`;
    }
    return 'https://via.placeholder.com/480x270/1a1a1a/666?text=No+Image';
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

    try {
      const res = await fetch(`${EMBY_SERVER}/Users/${user.User.Id}/Items/${item.Id}?Fields=Overview,People,Genres,CommunityRating,OfficialRating,ProductionYear&api_key=${API_KEY}`, {headers:{'X-Emby-Token':user.AccessToken}});
      const details = await res.json();
      setItemDetails(details);

      if (details.Type === 'Series') {
        const seasonsUrl = `${EMBY_SERVER}/Shows/${item.Id}/Seasons?userId=${user.User.Id}&Fields=Overview,IndexNumber&api_key=${API_KEY}`;
        console.log('🎬 Loading seasons from:', seasonsUrl);

        const sRes = await fetch(seasonsUrl, {headers:{'X-Emby-Token':user.AccessToken}});
        console.log('📡 Seasons response status:', sRes.status);

        if (sRes.ok) {
          const sData = await sRes.json();
          console.log('✅ Seasons data:', sData);
          const seasonsList = (sData.Items || []).filter(s => s.IndexNumber !== 0);
          console.log('📺 Seasons found (excluding specials):', seasonsList.length);
          console.log('📋 Seasons list:', seasonsList);

          setSeasons(seasonsList);
          if (seasonsList.length > 0) {
            const firstSeasonId = seasonsList[0].Id;
            console.log('🎯 Loading episodes for first season ID:', firstSeasonId, 'Name:', seasonsList[0].Name);
            setSelectedSeason(firstSeasonId);
            await loadEps(firstSeasonId);
          }
        } else {
          console.error('❌ Failed to load seasons:', sRes.status);
        }
      }
    } catch (error) {
      console.error('Error loading details:', error);
    }
    setLoadingDetails(false);
  };

  const loadEps = async (seasonId) => {
    if (!user || !seasonId) return;

    setLoadingEpisodes(true);
    setSelectedSeason(seasonId);
    setEpisodes([]);

    try {
      // Provo ENTRAMBI gli endpoint Emby per essere sicuro
      const url1 = `${EMBY_SERVER}/Shows/${seasonId}/Episodes?userId=${user.User.Id}&Fields=Overview,PrimaryImageAspectRatio,SeriesInfo,UserData&api_key=${API_KEY}`;
      const url2 = `${EMBY_SERVER}/Users/${user.User.Id}/Items?ParentId=${seasonId}&Fields=Overview,PrimaryImageAspectRatio,UserData&api_key=${API_KEY}`;

      console.log('🔍 Trying endpoint 1:', url1);
      let res = await fetch(url1, {headers:{'X-Emby-Token':user.AccessToken}});

      console.log('📡 Endpoint 1 response:', res.status, res.statusText);

      // Se il primo fallisce, provo il secondo
      if (!res.ok) {
        console.log('🔄 Trying endpoint 2:', url2);
        res = await fetch(url2, {headers:{'X-Emby-Token':user.AccessToken}});
        console.log('📡 Endpoint 2 response:', res.status, res.statusText);
      }

      if (res.ok) {
        const data = await res.json();
        console.log('✅ Episodes API response:', data);
        const episodesList = data.Items || [];
        console.log('📺 Episodes found:', episodesList.length);
        if (episodesList.length > 0) {
          console.log('📋 First episode sample:', episodesList[0]);
        }
        setEpisodes(episodesList);
      } else {
        const errorText = await res.text();
        console.error('❌ Both endpoints failed');
        console.error('❌ Status:', res.status, res.statusText);
        console.error('❌ Error response:', errorText);
      }
    } catch (error) {
      console.error('💥 Error loading episodes:', error);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const closeModal = () => {
    setSelectedItem(null);
    setItemDetails(null);
    setSeasons([]);
    setSelectedSeason(null);
    setEpisodes([]);
  };

  const startPlay = async (item, resumePositionTicks = 0) => {
    console.log('🎬 Starting playback for:', item.Name);

    // STEP 1: Chiama PlaybackInfo API per ottenere MediaSourceId e info transcodifica
    try {
      const playbackInfoRes = await fetch(
        `${EMBY_SERVER}/Items/${item.Id}/PlaybackInfo?UserId=${user.User.Id}&api_key=${API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Emby-Token': user.AccessToken
          },
          body: JSON.stringify({
            DeviceProfile: {
              MaxStreamingBitrate: 199680000,
              MaxStaticBitrate: 199680000,
              MusicStreamingTranscodingBitrate: 320000,
              DirectPlayProfiles: [
                { Container: 'mp4,m4v', Type: 'Video', VideoCodec: 'h264,hevc,av1', AudioCodec: 'aac,mp3,ac3,eac3' },
                { Container: 'mkv', Type: 'Video', VideoCodec: 'h264,hevc,av1', AudioCodec: 'aac,mp3,ac3,eac3,dts' },
                { Container: 'webm', Type: 'Video', VideoCodec: 'vp8,vp9,av1', AudioCodec: 'vorbis,opus' }
              ],
              TranscodingProfiles: [
                {
                  Container: 'ts',
                  Type: 'Video',
                  VideoCodec: 'h264,hevc',
                  AudioCodec: 'aac,mp3,ac3',
                  Protocol: 'hls',
                  EstimateContentLength: false,
                  EnableMpegtsM2TsMode: false,
                  TranscodeSeekInfo: 'Auto',
                  CopyTimestamps: false,
                  Context: 'Streaming',
                  EnableSubtitlesInManifest: true,
                  MinSegments: 1,
                  BreakOnNonKeyFrames: true
                }
              ],
              CodecProfiles: [
                {
                  Type: 'Video',
                  Codec: 'h264',
                  Conditions: [
                    { Condition: 'LessThanEqual', Property: 'Width', Value: '1920' },
                    { Condition: 'LessThanEqual', Property: 'Height', Value: '1080' },
                    { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '62' }
                  ]
                },
                {
                  Type: 'Video',
                  Codec: 'hevc',
                  Conditions: [
                    { Condition: 'LessThanEqual', Property: 'Width', Value: '3840' },
                    { Condition: 'LessThanEqual', Property: 'Height', Value: '2160' }
                  ]
                }
              ],
              SubtitleProfiles: [
                { Format: 'vtt', Method: 'External' },
                { Format: 'ass', Method: 'External' },
                { Format: 'ssa', Method: 'External' },
                { Format: 'srt', Method: 'External' }
              ]
            }
          })
        }
      );
      const playbackInfo = await playbackInfoRes.json();
      console.log('📊 PlaybackInfo ricevuto:', playbackInfo);

      // Ottieni il MediaSource dalla risposta
      const mediaSource = playbackInfo.MediaSources?.[0];
      if (mediaSource) {
        setMediaSourceId(mediaSource.Id);
        console.log('✅ MediaSourceId:', mediaSource.Id);
      }

      // STEP 2: Carica le tracce audio dal server Emby
      const res = await fetch(
        `${EMBY_SERVER}/Users/${user.User.Id}/Items/${item.Id}?Fields=MediaSources,MediaStreams&api_key=${API_KEY}`,
        { headers: { 'X-Emby-Token': user.AccessToken } }
      );
      const data = await res.json();

      // Estrai le tracce audio e sottotitoli
      const audioStreams = [];
      const subtitleStreams = [];

      if (data.MediaSources && data.MediaSources[0]) {
        const mediaSource = data.MediaSources[0];
        setMediaSourceId(mediaSource.Id);
        const streams = mediaSource.MediaStreams || [];
        streams.forEach(stream => {
          if (stream.Type === 'Audio') {
            audioStreams.push({
              index: stream.Index,
              language: stream.Language || 'und',
              displayLanguage: stream.DisplayLanguage || stream.Language || 'Sconosciuta',
              title: stream.Title || '',
              codec: stream.Codec || '',
              isDefault: stream.IsDefault || false
            });
          } else if (stream.Type === 'Subtitle') {
            subtitleStreams.push({
              index: stream.Index,
              language: stream.Language || 'und',
              displayLanguage: stream.DisplayLanguage || stream.Language || 'Sconosciuta',
              title: stream.Title || '',
              codec: stream.Codec || '',
              isDefault: stream.IsDefault || false,
              isForced: stream.IsForced || false,
              deliveryUrl: stream.DeliveryUrl || null
            });
          }
        });
      }

      console.log('🎵 Tracce audio trovate:', audioStreams);
      console.log('📝 Tracce sottotitoli trovate:', subtitleStreams);

      setAudioTracks(audioStreams);
      setSubtitleTracks(subtitleStreams);

      // Seleziona la traccia italiana come default, altrimenti la prima
      const italianTrack = audioStreams.find(t => t.language === 'ita' || t.language === 'it');
      const defaultTrack = italianTrack || audioStreams.find(t => t.isDefault) || audioStreams[0];

      if (defaultTrack) {
        console.log('🎵 Traccia audio selezionata:', defaultTrack.displayLanguage, '(index:', defaultTrack.index, ')');
        setSelectedAudioTrack(defaultTrack.index);
      } else {
        setSelectedAudioTrack(null);
      }

      // Seleziona sottotitoli italiani se disponibili
      const italianSub = subtitleStreams.find(t => t.language === 'ita' || t.language === 'it');
      if (italianSub) {
        console.log('📝 Sottotitoli selezionati:', italianSub.displayLanguage);
        setSelectedSubtitleTrack(italianSub.index);
      } else {
        setSelectedSubtitleTrack(null);
      }

      // IMPORTANTE: Aspetta che React aggiorni lo stato prima di aprire il player
      // Questo assicura che il video parta con la traccia corretta
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error('❌ Errore caricamento tracce:', error);
      setAudioTracks([]);
      setSelectedAudioTrack(null);
      setSubtitleTracks([]);
      setSelectedSubtitleTrack(null);
    }

    // Imposta StartTimeTicks per seeking fluido (se vogliamo riprendere da una posizione specifica)
    setStartTimeTicks(resumePositionTicks);
    console.log('⏱️ StartTimeTicks impostato a:', resumePositionTicks, '(', resumePositionTicks / 10000000, 's)');

    setPlayingItem(item);
    setIsPlaying(true);
  };

  // Converte qualità selezionata in bitrate
  const getVideoBitrate = (quality) => {
    const bitrates = {
      'auto': '199680000',    // ~200 Mbps - massima qualità
      '1080p': '8000000',     // 8 Mbps
      '720p': '4000000',      // 4 Mbps
      '480p': '1500000',      // 1.5 Mbps
      '360p': '700000'        // 0.7 Mbps
    };
    return bitrates[quality] || bitrates['auto'];
  };

  // Inizializza Hls.js quando il player si apre
  useEffect(() => {
    if (playingItem && videoRef.current && !hlsRef.current && selectedAudioTrack !== null) {
      console.log('🎬 Inizializzo Hls.js player');
      console.log('📱 Dispositivo mobile:', isMobile);

      // Genera nuovo PlaySessionId per questa sessione
      const newPlaySessionId = generatePlaySessionId();
      setPlaySessionId(newPlaySessionId);

      // HLS COMPLETO esattamente come Emby ufficiale
      // Su mobile: AAC/MP3 (AC3 non supportato su Android Chrome)
      // Su desktop: AC3/MP3/AAC (pieno supporto)
      const params = new URLSearchParams({
        DeviceId: DEVICE_ID,
        MediaSourceId: mediaSourceId || `mediasource_${playingItem.Id}`,
        PlaySessionId: newPlaySessionId,
        api_key: API_KEY,
        VideoCodec: 'hevc,h264,av1',
        AudioCodec: isMobile ? 'aac,mp3' : 'ac3,mp3,aac',
        VideoBitrate: getVideoBitrate(selectedQuality),
        AudioBitrate: '320000',
        AudioStreamIndex: selectedAudioTrack,
        TranscodingMaxAudioChannels: '2',
        SegmentContainer: 'ts',
        MinSegments: '1',
        BreakOnNonKeyFrames: 'True',
        'h264-profile': 'high,main,baseline,constrainedbaseline,high10',
        'h264-level': '62',
        'hevc-codectag': 'hvc1,hev1,hevc,hdmv'
      });

      console.log('🎵 Codec audio:', params.get('AudioCodec'));

      // Aggiungi StartTimeTicks se vogliamo iniziare da una posizione specifica
      if (startTimeTicks > 0) {
        params.set('StartTimeTicks', startTimeTicks.toString());
        console.log('⏱️ HLS con StartTimeTicks:', startTimeTicks, '(', startTimeTicks / 10000000, 's)');
      }

      const videoUrl = `${EMBY_SERVER}/Videos/${playingItem.Id}/master.m3u8?${params.toString()}`;
      console.log('🎬 HLS URL:', videoUrl);
      console.log('🎬 PlaySessionId:', newPlaySessionId, 'AudioIndex:', selectedAudioTrack);

      const video = videoRef.current;

      // FORZA Hls.js anche se il browser supporta HLS nativo
      // Motivo: AudioStreamIndex nell'URL non funziona con HLS nativo (Safari/Edge)
      // Hls.js gestisce correttamente le tracce audio multiple
      if (Hls.isSupported()) {
        console.log('✅ Hls.js supportato, inizializzo...');

        const hls = new Hls({
          debug: false,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 90
        });

        hlsRef.current = hls;

        // Carica il manifest
        hls.loadSource(videoUrl);
        hls.attachMedia(video);

        // EVENTO: Manifest parsato
        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log('✅ Manifest HLS parsato');
          console.log('📊 Livelli disponibili:', data.levels.length);
          console.log('🎵 Tracce audio disponibili:', data.audioTracks?.length || 0);

          // Imposta durata
          const durationFromEmby = playingItem.RunTimeTicks ? playingItem.RunTimeTicks / 10000000 : video.duration;
          setDuration(durationFromEmby);
          console.log('✅ Durata:', Math.floor(durationFromEmby/60), 'min');

          // Auto-play
          video.play().catch(e => console.error('❌ Errore autoplay:', e));

          // Notifica Emby
          reportPlaybackStart(playingItem);
        });

        // EVENTO: Errori
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('❌ Hls.js Error:', data.type, data.details);
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('💔 Errore di rete fatale, tento recovery...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('💔 Errore media fatale, tento recovery...');
                hls.recoverMediaError();
                break;
              default:
                console.error('💔 Errore irrecuperabile, distruggo player');
                hls.destroy();
                hlsRef.current = null;
                break;
            }
          }
        });

      } else {
        console.error('❌ HLS non supportato in questo browser!');
      }

      // Eventi video HTML5
      video.addEventListener('timeupdate', () => {
        setCurrentTime(video.currentTime);
      });

      video.addEventListener('loadedmetadata', () => {
        console.log('✅ Metadata caricati');
        if (startTimeTicks > 0) {
          console.log('✅ Video ripreso da StartTimeTicks:', startTimeTicks / 10000000, 's');
        }
      });

      video.addEventListener('play', () => {
        setIsPlaying(true);
      });

      video.addEventListener('pause', () => {
        setIsPlaying(false);
      });

      // Avvia tracking Emby ogni 10s
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      progressIntervalRef.current = setInterval(() => {
        if (video && playingItem) {
          reportPlaybackProgress(playingItem, video.currentTime * 1000);
        }
      }, 10000);
    }

    // Cleanup
    return () => {
      if (hlsRef.current) {
        console.log('🧹 Cleanup Hls.js player');
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [playingItem, selectedAudioTrack, selectedQuality]);

  const closePlayer = async () => {
    // CRITICAL: Prima termina FFmpeg sul server, POI notifica la fine
    try {
      // 1. DELETE ActiveEncodings - Termina il processo FFmpeg sul server
      await fetch(`${EMBY_SERVER}/Videos/ActiveEncodings?DeviceId=${DEVICE_ID}`, {
        method: 'DELETE',
        headers: {
          'X-Emby-Token': user?.AccessToken || ''
        }
      });
      console.log('🛑 FFmpeg process terminato sul server');
    } catch (error) {
      console.error('❌ Errore terminazione FFmpeg:', error);
    }

    // 2. Notifica Emby della fine della riproduzione
    if (playingItem && videoRef.current) {
      await reportPlaybackStopped(playingItem, videoRef.current.currentTime * 1000);
    }

    // Ferma l'aggiornamento del progresso
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // Distruggi Hls.js
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Reset video element
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
    }

    setPlayingItem(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioTracks([]);
    setSelectedAudioTrack(null);
    setShowAudioMenu(false);
    setSubtitleTracks([]);
    setSelectedSubtitleTrack(null);
    setShowSubtitleMenu(false);
    setMediaSourceId(null);
    setPlaySessionId(null);
    setStartTimeTicks(0);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      const willBePlaying = !isPlaying;

      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }

      setIsPlaying(willBePlaying);

      // EVENT-BASED REPORTING: Invia report immediato quando cambia lo stato play/pause
      if (playingItem) {
        reportPlaybackProgress(playingItem, videoRef.current.currentTime * 1000);
        console.log('⏯️ Event report:', willBePlaying ? 'Unpause' : 'Pause');
      }
    }
  };

  const skip = (sec) => {
    if (videoRef.current) {
      const newTime = videoRef.current.currentTime + sec;
      console.log('⏩ Skip', sec, 's - nuovo tempo:', Math.floor(newTime), 's');
      videoRef.current.currentTime = newTime;
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
    if (videoRef.current) {
      videoRef.current.volume = vol;

      // EVENT-BASED REPORTING: Invia report quando l'utente cambia il volume
      if (playingItem) {
        reportPlaybackProgress(playingItem, videoRef.current.currentTime * 1000);
        console.log('🔊 Event report: VolumeChange to', Math.round(vol * 100) + '%');
      }
    }
  };

  const toggleFull = () => {
    const container = document.getElementById('player-container');
    if (!container) return;

    if (document.fullscreenElement) {
      // Esci da fullscreen
      document.exitFullscreen();
    } else {
      // Entra in fullscreen sul container (non sul video!)
      // Questo nasconde i controlli nativi del browser
      container.requestFullscreen().catch(err => {
        console.error('Errore fullscreen:', err);
      });
    }
  };

  const showCtrls = () => {
    if (!isMobile) {
      // Solo desktop: mostra controlli con timeout auto-hide
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) setShowControls(false);
      }, 3000);
    }
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

  const getVideoUrl = (item) => {
    if (!item || !user) return '';
    // Funzione deprecata - l'URL viene costruito direttamente nel useEffect
    return '';
  };

  const changeAudioTrack = (trackIndex) => {
    console.log('🎵 Cambio traccia audio a index:', trackIndex);

    // Se è già la traccia selezionata, non fare nulla
    if (trackIndex === selectedAudioTrack) {
      console.log('ℹ️ Traccia già selezionata, nessun cambio necessario');
      setShowAudioMenu(false);
      return;
    }

    if (videoRef.current && playingItem) {
      // PROTOCOLLO EMBY: Seamless Audio Track Switching con StartTimeTicks

      // Salva la posizione corrente e convertila in Ticks
      const currentTimeSeconds = videoRef.current.currentTime;
      const resumePositionTicks = Math.floor(currentTimeSeconds * 10000000);
      console.log('⏸️ Salvo posizione corrente:', currentTimeSeconds, 's (', resumePositionTicks, 'ticks)');

      // Imposta StartTimeTicks per riprendere dalla stessa posizione con la nuova traccia
      setStartTimeTicks(resumePositionTicks);

      // Distruggi Hls.js corrente
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Aggiorna la traccia selezionata - il useEffect ricreerà il player con:
      // - Nuovo AudioStreamIndex
      // - StartTimeTicks dalla posizione corrente
      // - Nuovo PlaySessionId
      setSelectedAudioTrack(trackIndex);
      setShowAudioMenu(false);
    } else {
      setSelectedAudioTrack(trackIndex);
      setShowAudioMenu(false);
    }
  };

  const changeQuality = (quality) => {
    console.log('🎬 Cambio qualità a:', quality);

    if (videoRef.current && playingItem && quality !== selectedQuality) {
      // Salva posizione corrente
      const currentTimeSeconds = videoRef.current.currentTime;
      const resumePositionTicks = Math.floor(currentTimeSeconds * 10000000);
      console.log('⏸️ Salvo posizione corrente:', currentTimeSeconds, 's');

      // Imposta StartTimeTicks per riprendere dalla stessa posizione
      setStartTimeTicks(resumePositionTicks);

      // Distruggi Hls.js corrente
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Aggiorna la qualità - il useEffect ricreerà il player
      setSelectedQuality(quality);
      setShowQualityMenu(false);
    } else {
      setSelectedQuality(quality);
      setShowQualityMenu(false);
    }
  };

  const changeSubtitleTrack = (trackIndex) => {
    console.log('📝 Cambio sottotitoli a index:', trackIndex);
    setSelectedSubtitleTrack(trackIndex);

    // HTML5 Video textTracks gestiti nativamente
    setTimeout(() => {
      if (videoRef.current) {
        const textTracks = videoRef.current.textTracks;

        // Disabilita tutti i sottotitoli
        for (let i = 0; i < textTracks.length; i++) {
          textTracks[i].mode = 'disabled';
        }

        // Abilita il sottotitolo selezionato
        if (trackIndex !== null) {
          for (let i = 0; i < textTracks.length; i++) {
            const track = textTracks[i];
            // Cerca la traccia corrispondente all'indice selezionato
            const matchingTrack = subtitleTracks.find((st, idx) => idx === i);
            if (matchingTrack && matchingTrack.index === trackIndex) {
              track.mode = 'showing';
              console.log('✅ Sottotitoli abilitati:', matchingTrack.displayLanguage);
              break;
            }
          }
        } else {
          console.log('❌ Sottotitoli disabilitati');
        }
      }
    }, 100);

    setShowSubtitleMenu(false);
  };

  // Notifica Emby dell'inizio della riproduzione
  const reportPlaybackStart = async (item) => {
    if (!user || !item || !playSessionId) return;

    try {
      const response = await fetch(`${EMBY_SERVER}/Sessions/Playing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Token': user.AccessToken
        },
        body: JSON.stringify({
          ItemId: item.Id,
          MediaSourceId: mediaSourceId || item.Id,
          PositionTicks: startTimeTicks,
          IsPaused: false,
          IsMuted: false,
          AudioStreamIndex: selectedAudioTrack,
          SubtitleStreamIndex: selectedSubtitleTrack,
          PlayMethod: 'Transcode', // HLS è sempre Transcode
          PlaySessionId: playSessionId // Usa lo stesso PlaySessionId dell'HLS!
        })
      });

      if (response.ok) {
        console.log('📊 Riproduzione iniziata notificata a Emby');
      } else {
        console.error('❌ Errore notifica:', response.status, await response.text());
      }
    } catch (error) {
      console.error('❌ Errore notifica inizio riproduzione:', error);
    }
  };

  // Aggiorna il progresso di riproduzione
  const reportPlaybackProgress = async (item, positionMs) => {
    if (!user || !item || !playSessionId) return;

    const positionTicks = Math.floor(positionMs * 10000); // Converti ms in ticks (1ms = 10000 ticks)

    try {
      await fetch(`${EMBY_SERVER}/Sessions/Playing/Progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Token': user.AccessToken
        },
        body: JSON.stringify({
          ItemId: item.Id,
          MediaSourceId: mediaSourceId || item.Id,
          PositionTicks: positionTicks,
          IsPaused: !isPlaying,
          IsMuted: isMuted,
          AudioStreamIndex: selectedAudioTrack,
          SubtitleStreamIndex: selectedSubtitleTrack,
          PlayMethod: 'Transcode', // HLS è sempre Transcode
          PlaySessionId: playSessionId // Usa lo stesso PlaySessionId dell'HLS!
        })
      });
      console.log('📊 Progresso aggiornato:', Math.floor(positionMs / 1000), 's');
    } catch (error) {
      console.error('❌ Errore aggiornamento progresso:', error);
    }
  };

  // Notifica la fine della riproduzione
  const reportPlaybackStopped = async (item, positionMs) => {
    if (!user || !item) return;

    const positionTicks = Math.floor(positionMs * 10000);

    try {
      await fetch(`${EMBY_SERVER}/Sessions/Playing/Stopped`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Token': user.AccessToken
        },
        body: JSON.stringify({
          ItemId: item.Id,
          PositionTicks: positionTicks
        })
      });
      console.log('📊 Fine riproduzione notificata a Emby');
    } catch (error) {
      console.error('❌ Errore notifica fine riproduzione:', error);
    }
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-600/20 hover:from-emerald-500/30 hover:to-green-600/30 border border-emerald-500/30 flex items-center justify-center cursor-help transition-all hover:scale-110 shadow-lg shadow-emerald-500/20">
              {EMBY_SERVER.includes('192.168.1.100') ? (
                <Home className="w-5 h-5 text-emerald-400" />
              ) : (
                <Cloud className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block"><div className="bg-black/90 backdrop-blur-xl border border-emerald-500/30 rounded-lg px-4 py-2 text-sm text-gray-300 whitespace-nowrap shadow-xl shadow-emerald-500/20"><span className="text-emerald-400 font-semibold">{EMBY_SERVER.includes('192.168.1.100') ? '🏠 Rete locale' : '☁️ Connessione remota'}</span><br/><span className="text-gray-500 text-xs">{EMBY_SERVER}</span></div></div>
          </div>
        </div>
      </div>
    );
  }

  const curr = featuredItems[currentHero];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 via-black/70 to-transparent px-4 md:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Mobile: Search espansa copre tutto */}
          {isMobile && searchExpanded ? (
            <div className="flex-1 flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Cerca film o serie TV..."
                  value={searchQuery}
                  onChange={e=>{setSearchQuery(e.target.value);handleSearch(e.target.value);setShowSearch(e.target.value.length>0);}}
                  className="w-full bg-emerald-600/20 backdrop-blur-xl border border-emerald-500/50 rounded-full pl-12 pr-12 py-3 text-white placeholder-gray-300 focus:outline-none focus:bg-emerald-600/30 focus:border-emerald-400 transition"
                  autoFocus
                />
                <button onClick={closeSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-400 hover:text-white transition">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop o Mobile normale */}
              <div className={isMobile ? "flex items-center gap-4" : "flex items-center gap-8"}>
                <h1 className={isMobile ? "text-2xl font-bold bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text text-transparent" : "text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-600 bg-clip-text text-transparent drop-shadow-lg"}>EMBY</h1>
                {!isMobile && (
                  <nav className="flex gap-2">
                    {['home','movies','series'].map(v=><button key={v} onClick={()=>{setActiveView(v);closeSearch();}} className={`text-sm font-semibold transition-all duration-300 px-4 py-2 rounded-lg ${activeView===v?'text-white bg-gradient-to-r from-emerald-600 to-green-600 shadow-lg shadow-emerald-500/30':'text-gray-400 hover:text-white hover:bg-white/10'}`}>{v==='home'?'HOME':v==='movies'?'FILM':'SERIE TV'}</button>)}
                  </nav>
                )}
              </div>

              {/* Mobile: Pulsanti HOME/FILM/SERIE solo quando search non espansa */}
              {isMobile && !searchExpanded && (
                <nav className="flex gap-2">
                  {['home','movies','series'].map(v=><button key={v} onClick={()=>{setActiveView(v);closeSearch();}} className={`text-xs font-semibold transition-all duration-300 px-3 py-1.5 rounded-lg ${activeView===v?'text-white bg-gradient-to-r from-emerald-600 to-green-600 shadow-lg':'text-gray-400 hover:text-white'}`}>{v==='home'?'HOME':v==='movies'?'FILM':'SERIE TV'}</button>)}
                </nav>
              )}

              {/* Search Bar - Desktop sempre visibile, Mobile icona */}
              {isMobile ? (
                <button
                  onClick={() => setSearchExpanded(true)}
                  className="bg-emerald-600/20 hover:bg-emerald-600/30 backdrop-blur-xl border border-emerald-500/50 rounded-full p-3 transition-all hover:scale-110 shadow-lg shadow-emerald-500/20"
                >
                  <Search className="w-5 h-5 text-emerald-400" />
                </button>
              ) : (
                <div className="flex-1 max-w-2xl mx-8">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-400 w-5 h-5 transition-colors" />
                    <input type="text" placeholder="Cerca film o serie TV..." value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);handleSearch(e.target.value);setShowSearch(e.target.value.length>0);}} className="w-full bg-white/5 backdrop-blur-xl border border-white/20 rounded-full pl-12 pr-12 py-3 text-white placeholder-gray-400 focus:outline-none focus:bg-white/10 focus:border-emerald-500 focus:shadow-lg focus:shadow-emerald-500/20 transition-all" />
                    {searchQuery && (
                      <button onClick={closeSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Link e logout - Nascosti su mobile quando search espansa */}
              {!isMobile && (
                <div className="flex items-center gap-4">
                  <button onClick={()=>setUser(null)} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition"><LogOut className="w-4 h-4" /></button>
                </div>
              )}
            </>
          )}
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
              {searchResults.map(item=><div key={item.Id} className="group cursor-pointer" onClick={()=>openDetails(item)}><img src={getImg(item)} alt={item.Name} className="w-full aspect-[2/3] object-cover rounded-lg group-hover:ring-4 group-hover:ring-emerald-500/60 group-hover:brightness-110 transition-all shadow-xl group-hover:shadow-2xl group-hover:shadow-emerald-500/30"/><p className="text-sm mt-2 truncate text-center font-medium">{item.Name}</p><p className="text-xs text-gray-400 text-center">{item.Type==='Movie'?'Film':'Serie TV'}</p></div>)}
            </div>
          </div>
        </div>
      )}

      {curr && (
        <div className={isMobile ? "relative h-[50vh]" : "relative h-[75vh]"}>
          <div className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ${heroFade?'opacity-100 scale-100':'opacity-0 scale-105'}`} style={{backgroundImage:`url(${getBackdrop(curr)||getImg(curr)})`}}>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/20"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
          </div>
          <div className={`relative h-full flex items-end ${isMobile ? 'px-4 pb-16' : 'px-8 md:px-16 pb-20'} transition-all duration-1000 ${heroFade?'opacity-100 translate-y-0':'opacity-0 translate-y-4'}`}>
            <div className={isMobile ? "space-y-2 w-full" : "max-w-3xl space-y-5"}>
              <h2 className={isMobile ? "text-4xl font-bold drop-shadow-2xl" : "text-5xl md:text-7xl font-bold drop-shadow-2xl"}>{curr.Name}</h2>
              <div className={isMobile ? "backdrop-blur-md bg-black/40 rounded-xl p-3" : "backdrop-blur-sm bg-black/30 rounded-xl p-4 inline-block"}>
                <p className={isMobile ? "text-sm text-gray-200 leading-relaxed" : "text-lg text-gray-200 leading-relaxed"}>
                  {curr.Overview?(expandedOverview?curr.Overview:truncate(curr.Overview,35)):'Nessuna descrizione.'}
                </p>
                {curr.Overview && curr.Overview.split(' ').length>35 && (
                  <button
                    onClick={()=>setExpandedOverview(!expandedOverview)}
                    className={isMobile ? "text-emerald-400 hover:text-emerald-300 text-xs mt-1.5 font-medium" : "text-emerald-400 hover:text-emerald-300 text-sm mt-2 font-medium"}
                  >
                    {expandedOverview?'Mostra meno':'Continua a leggere...'}
                  </button>
                )}
              </div>
              <div className={isMobile ? "flex gap-2 pt-1" : "flex gap-4 pt-2"}>
                <button onClick={()=>startPlay(curr)} className={isMobile ? "flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl font-semibold text-sm transition shadow-2xl" : "flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-xl font-semibold text-lg transition transform hover:scale-105 shadow-2xl"}><Play className={isMobile ? "w-5 h-5 fill-current" : "w-6 h-6 fill-current"}/>{isMobile ? "Play" : "Riproduci"}</button>
                <button onClick={()=>openDetails(curr)} className={isMobile ? "flex items-center gap-2 bg-white/20 backdrop-blur-md hover:bg-white/30 px-5 py-3 rounded-xl font-semibold text-sm transition shadow-xl" : "flex items-center gap-3 bg-white/20 backdrop-blur-md hover:bg-white/30 px-10 py-4 rounded-xl font-semibold text-lg transition shadow-xl"}><Info className={isMobile ? "w-5 h-5" : "w-6 h-6"}/>{isMobile ? "Info" : "Più info"}</button>
              </div>
            </div>
          </div>
          {/* Frecce navigazione - Solo desktop */}
          {!isMobile && (
            <>
              <button
                onClick={()=>{setHeroFade(false);setTimeout(()=>{setCurrentHero((currentHero-1+featuredItems.length)%featuredItems.length);setExpandedOverview(false);setHeroFade(true);},800);}}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-3 rounded-full transition backdrop-blur-sm"
              >
                <ChevronLeft className="w-8 h-8"/>
              </button>
              <button
                onClick={()=>{setHeroFade(false);setTimeout(()=>{setCurrentHero((currentHero+1)%featuredItems.length);setExpandedOverview(false);setHeroFade(true);},800);}}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-3 rounded-full transition backdrop-blur-sm"
              >
                <ChevronRight className="w-8 h-8"/>
              </button>
            </>
          )}
        </div>
      )}

      <div className="relative -mt-20 px-8 md:px-16 pb-16 space-y-16">
        {activeView==='home' && continueWatching.length>0 &&(
          <div className="pt-12">
            {/* Titolo sezione premium con badge */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-transparent px-4 py-2 rounded-full border-l-4 border-emerald-500 backdrop-blur-sm">
                <Play className="w-5 h-5 text-emerald-400 fill-emerald-400"/>
                <h3 className="text-2xl font-bold">Continua a guardare</h3>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-emerald-500/30 to-transparent"></div>
            </div>

            <div className="relative group">
              <button onClick={()=>scroll('continue','left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-emerald-600/20 hover:bg-emerald-600/40 backdrop-blur-md border border-emerald-500/30 p-3 rounded-full opacity-0 group-hover:opacity-100 transition shadow-xl shadow-emerald-500/20"><ChevronLeft className="w-6 h-6 text-emerald-400"/></button>
              <div id="continue" className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth">
                {continueWatching.map(item=>{
                  if(item.Type==='Episode'){
                    return <div key={item.Id} className="flex-none w-72 cursor-pointer group/card" onClick={()=>startPlay(item)}>
                      <div className="relative overflow-hidden rounded-xl">
                        <img src={getHorizontalImg(item)} alt={item.SeriesName} className="w-full aspect-video object-cover group-hover/card:scale-105 transition-all duration-500 shadow-lg"/>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center"><div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-full p-3 shadow-2xl scale-90 group-hover/card:scale-100 transition-transform duration-300"><Play className="w-6 h-6 fill-white"/></div></div>
                        {item.UserData?.PlayedPercentage && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60"><div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/50 transition-all" style={{width:`${item.UserData.PlayedPercentage}%`}}></div></div>}
                        <div className="absolute bottom-3 left-3 right-3">
                          <p className="text-sm font-bold text-white drop-shadow-lg line-clamp-1">{item.SeriesName}</p>
                          <p className="text-xs text-emerald-400 font-semibold drop-shadow-lg">S{item.ParentIndexNumber} E{item.IndexNumber}</p>
                        </div>
                      </div>
                    </div>;
                  }
                  return <div key={item.Id} className="flex-none w-72 cursor-pointer group/card" onClick={()=>startPlay(item)}>
                    <div className="relative overflow-hidden rounded-xl">
                      <img src={getHorizontalImg(item)} alt={item.Name} className="w-full aspect-video object-cover group-hover/card:scale-105 transition-all duration-500 shadow-lg"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center"><div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-full p-3 shadow-2xl scale-90 group-hover/card:scale-100 transition-transform duration-300"><Play className="w-6 h-6 fill-white"/></div></div>
                      {item.UserData?.PlayedPercentage && <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/60"><div className="h-full bg-gradient-to-r from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/50 transition-all" style={{width:`${item.UserData.PlayedPercentage}%`}}></div></div>}
                      <div className="absolute bottom-3 left-3 right-3">
                        <p className="text-sm font-bold text-white drop-shadow-lg line-clamp-1">{item.Name}</p>
                      </div>
                    </div>
                  </div>;
                })}
              </div>
              <button onClick={()=>scroll('continue','right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-emerald-600/20 hover:bg-emerald-600/40 backdrop-blur-md border border-emerald-500/30 p-3 rounded-full opacity-0 group-hover:opacity-100 transition shadow-xl shadow-emerald-500/20"><ChevronRight className="w-6 h-6 text-emerald-400"/></button>
            </div>
          </div>
        )}

        {activeView==='home' && libraries.map(lib=>(
          <div key={lib.Id}>
            <div className="mb-6 flex items-center gap-3">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{lib.Name}</h3>
              <div className="flex-1 h-px bg-gradient-to-r from-white/20 to-transparent"></div>
            </div>
            <div className="relative group">
              <button onClick={()=>scroll(`row-${lib.Id}`,'left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-emerald-600/40 backdrop-blur-md border border-white/20 hover:border-emerald-500/50 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-xl hover:scale-110"><ChevronLeft className="w-6 h-6 hover:text-emerald-400 transition-colors"/></button>
              <div id={`row-${lib.Id}`} className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide scroll-smooth">
                {(lib.CollectionType==='movies'?movieLibrary:lib.CollectionType==='tvshows'?seriesLibrary:featuredItems).slice(0,20).map(item=><div key={item.Id} className="flex-none w-48 cursor-pointer" onClick={()=>openDetails(item)}><img src={getImg(item)} alt={item.Name} className="w-full aspect-[2/3] object-cover rounded-lg hover:ring-4 hover:ring-emerald-500/60 hover:brightness-110 transition-all duration-500 shadow-xl hover:shadow-2xl hover:shadow-emerald-500/30"/><p className="mt-3 text-sm font-medium text-center line-clamp-2">{item.Name}</p></div>)}
              </div>
              <button onClick={()=>scroll(`row-${lib.Id}`,'right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-emerald-600/40 backdrop-blur-md border border-white/20 hover:border-emerald-500/50 p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 shadow-xl hover:scale-110"><ChevronRight className="w-6 h-6 hover:text-emerald-400 transition-colors"/></button>
            </div>
          </div>
        ))}

        {activeView==='movies' && (
          <div ref={movieGridRef}>
            <div className="flex justify-between items-center mb-8 pt-12">
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">Film</h3>
                <div className="flex-1 h-px bg-gradient-to-r from-white/30 to-transparent w-20"></div>
              </div>
              <select value={movieSortOrder} onChange={e=>loadMoviesSort(e.target.value)} className="bg-gradient-to-r from-emerald-950/90 to-gray-900/90 backdrop-blur-xl border-2 border-emerald-500/40 rounded-xl px-5 py-2.5 text-white focus:outline-none focus:border-emerald-400 focus:shadow-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer">
                <option value="Random" className="bg-gray-900 text-white">🎲 Casuale</option>
                <option value="SortName" className="bg-gray-900 text-white">🔤 A-Z</option>
                <option value="DateCreated" className="bg-gray-900 text-white">📅 Più recenti</option>
                <option value="PremiereDate" className="bg-gray-900 text-white">🎬 Data uscita</option>
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {movieLibrary.map(item=><div key={item.Id} className="cursor-pointer" onClick={()=>openDetails(item)}><img src={getImg(item)} alt={item.Name} className="w-full aspect-[2/3] object-cover rounded-lg hover:ring-4 hover:ring-emerald-500/60 hover:brightness-110 transition-all duration-500 shadow-xl hover:shadow-2xl hover:shadow-emerald-500/30"/><p className="mt-3 text-sm font-medium text-center line-clamp-2">{item.Name}</p></div>)}
            </div>
            {loadingMore && <div className="text-center py-8"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div></div>}
            {!hasMoreMovies && movieLibrary.length > 0 && <div className="text-center py-8 text-gray-400">Tutti i film caricati</div>}
          </div>
        )}

        {activeView==='series' && (
          <div ref={seriesGridRef}>
            <div className="flex justify-between items-center mb-8 pt-12">
              <div className="flex items-center gap-3">
                <h3 className="text-3xl font-bold bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">Serie TV</h3>
                <div className="flex-1 h-px bg-gradient-to-r from-white/30 to-transparent w-20"></div>
              </div>
              <select value={seriesSortOrder} onChange={e=>loadSeriesSort(e.target.value)} className="bg-gradient-to-r from-emerald-950/90 to-gray-900/90 backdrop-blur-xl border-2 border-emerald-500/40 rounded-xl px-5 py-2.5 text-white focus:outline-none focus:border-emerald-400 focus:shadow-emerald-500/30 hover:border-emerald-500/60 transition-all shadow-lg shadow-emerald-500/10 cursor-pointer">
                <option value="Random" className="bg-gray-900 text-white">🎲 Casuale</option>
                <option value="SortName" className="bg-gray-900 text-white">🔤 A-Z</option>
                <option value="DateCreated" className="bg-gray-900 text-white">📅 Più recenti</option>
                <option value="PremiereDate" className="bg-gray-900 text-white">📺 Data uscita</option>
              </select>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {seriesLibrary.map(item=><div key={item.Id} className="cursor-pointer" onClick={()=>openDetails(item)}><img src={getImg(item)} alt={item.Name} className="w-full aspect-[2/3] object-cover rounded-lg hover:ring-4 hover:ring-emerald-500/60 hover:brightness-110 transition-all duration-500 shadow-xl hover:shadow-2xl hover:shadow-emerald-500/30"/><p className="mt-3 text-sm font-medium text-center line-clamp-2">{item.Name}</p></div>)}
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
              <div className="p-6">
                <div className="grid md:grid-cols-[300px_1fr] gap-6 mb-6">
                  <div><img src={getImg(itemDetails)} alt={itemDetails.Name} className="w-full rounded-lg shadow-2xl"/></div>
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-2xl font-bold mb-2">{itemDetails.Name}</h2>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {itemDetails.ProductionYear && <span>{itemDetails.ProductionYear}</span>}
                        {itemDetails.OfficialRating && <span className="px-2 py-1 border border-gray-600 rounded">{itemDetails.OfficialRating}</span>}
                        {itemDetails.CommunityRating && <span className="flex items-center gap-1"><Star className="w-3 h-3 fill-yellow-500 text-yellow-500"/>{itemDetails.CommunityRating.toFixed(1)}</span>}
                      </div>
                    </div>
                    <button onClick={()=>{closeModal();startPlay(itemDetails.Type==='Series'&&episodes.length>0?episodes[0]:itemDetails);}} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition transform hover:scale-105 shadow-lg"><Play className="w-5 h-5 fill-current"/>Riproduci</button>
                    {itemDetails.Overview && <div><h3 className="text-lg font-semibold mb-1">Trama</h3><p className="text-gray-300 text-sm leading-relaxed line-clamp-3">{itemDetails.Overview}</p></div>}
                    {itemDetails.Genres?.length>0 && <div className="text-sm"><span className="text-gray-400">Generi: </span><span className="text-white">{itemDetails.Genres.join(', ')}</span></div>}
                    {itemDetails.People?.filter(p=>p.Type==='Actor').length>0 && <div><h3 className="text-lg font-semibold mb-2">Cast</h3><div className="flex flex-wrap gap-2">{itemDetails.People.filter(p=>p.Type==='Actor').slice(0,6).map(p=><span key={p.Id} className="bg-white/10 hover:bg-white/20 px-2 py-1 rounded-full text-xs text-gray-300 transition">{p.Name}</span>)}</div></div>}

                    {itemDetails.Type==='Series' && seasons.length>0 && (
                      <div className="space-y-2 mt-4">
                        <div>
                          <label className="block text-lg font-semibold mb-2">Stagione</label>
                          <div className="relative">
                            <select value={selectedSeason||''} onChange={e=>loadEps(e.target.value)} className="w-full max-w-xs bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 appearance-none">
                              {seasons.map(s=><option key={s.Id} value={s.Id} className="bg-gray-800 text-white">{s.Name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"/>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sezione episodi a tutta larghezza */}
                {itemDetails.Type==='Series' && seasons.length>0 && (
                  <div className="w-full">
                    {loadingEpisodes ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                        <span className="ml-3 text-gray-400">Caricamento episodi...</span>
                      </div>
                    ) : episodes.length > 0 ? (
                      <div className="space-y-4">
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">Episodi ({episodes.length})</h3>
                        <div className="relative group/container">
                          <button onClick={()=>scroll(`eps-${selectedSeason}`,'left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/80 hover:bg-emerald-600/90 backdrop-blur-xl p-3 rounded-full opacity-0 group-hover/container:opacity-100 transition-all duration-300 shadow-2xl border border-white/10 hover:border-emerald-500/50 hover:scale-110">
                            <ChevronLeft className="w-6 h-6"/>
                          </button>
                          <div id={`eps-${selectedSeason}`} className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide scroll-smooth">
                            {episodes.map(ep=><div key={ep.Id} className="flex-none w-[420px] bg-gradient-to-br from-white/10 via-white/5 to-transparent hover:from-emerald-600/20 hover:via-emerald-500/10 hover:to-transparent backdrop-blur-sm border border-white/10 hover:border-emerald-500/50 rounded-2xl overflow-hidden transition-all duration-500 cursor-pointer group/card hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/20" onClick={()=>{closeModal();startPlay(ep);}}>
                              <div className="relative aspect-video bg-gradient-to-br from-gray-900 to-black overflow-hidden">
                                {ep.ImageTags?.Primary?<img src={getImg(ep,'Primary')} alt={ep.Name} className="w-full h-full object-cover group-hover/card:scale-110 transition-transform duration-700"/>:<div className="w-full h-full flex items-center justify-center"><Play className="w-16 h-16 text-gray-700"/></div>}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover/card:opacity-80 transition-opacity duration-500"></div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                  <div className="bg-gradient-to-r from-emerald-600 to-green-600 rounded-full p-4 scale-75 group-hover/card:scale-100 transition-transform duration-300 shadow-2xl">
                                    <Play className="w-8 h-8 fill-white"/>
                                  </div>
                                </div>
                                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/20">
                                  <span className="text-emerald-400 font-bold text-sm">Episodio {ep.IndexNumber}</span>
                                </div>
                                {ep.RunTimeTicks && (
                                  <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/20">
                                    <span className="text-gray-300 text-sm font-medium">{Math.floor(ep.RunTimeTicks/600000000)} min</span>
                                  </div>
                                )}
                                {ep.UserData?.PlayedPercentage > 0 && (
                                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 backdrop-blur-sm">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/50 transition-all duration-300" style={{width:`${ep.UserData.PlayedPercentage}%`}}></div>
                                  </div>
                                )}
                              </div>
                              <div className="p-5 space-y-3">
                                <h4 className="text-lg font-bold text-white group-hover/card:text-emerald-400 transition-colors duration-300 line-clamp-1">{ep.Name || `Episodio ${ep.IndexNumber}`}</h4>
                                {ep.Overview && <p className="text-gray-400 text-sm leading-relaxed line-clamp-3 group-hover/card:text-gray-300 transition-colors duration-300">{ep.Overview}</p>}
                              </div>
                            </div>)}
                          </div>
                          <button onClick={()=>scroll(`eps-${selectedSeason}`,'right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/80 hover:bg-emerald-600/90 backdrop-blur-xl p-3 rounded-full opacity-0 group-hover/container:opacity-100 transition-all duration-300 shadow-2xl border border-white/10 hover:border-emerald-500/50 hover:scale-110">
                            <ChevronRight className="w-6 h-6"/>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        Nessun episodio trovato per questa stagione
                      </div>
                    )}
                  </div>
                )}
              </div>
            ):<div className="flex items-center justify-center py-20"><div className="text-white text-lg">Errore nel caricamento</div></div>}
          </div>
        </div>
      )}

      {playingItem && (
        <div
          id="player-container"
          className="fixed inset-0 z-[200] bg-black flex items-center justify-center overflow-hidden"
          onMouseMove={!isMobile ? showCtrls : undefined}
          style={{
            // Nasconde scrollbar browser su mobile
            overflow: 'hidden',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        >
          {/* HTML5 Video Player con Hls.js */}
          <div className="w-full h-full relative">
            <video
              ref={videoRef}
              className="w-full h-full object-contain bg-black"
              onClick={isMobile ? () => setShowControls(!showControls) : togglePlay}
              playsInline
              disablePictureInPicture
              crossOrigin="anonymous"
            >
            </video>
          </div>

          {/* Indicatore Skip +10/-10 secondi - Premium */}
          {showSkipIndicator && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <div className="bg-black/80 backdrop-blur-3xl rounded-3xl px-10 py-8 border border-emerald-500/40 shadow-2xl shadow-emerald-500/30 animate-pulse">
                {showSkipIndicator > 0 ? (
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <RotateCw className="w-14 h-14 text-emerald-400"/>
                      <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-50"></div>
                    </div>
                    <span className="text-4xl font-black text-white drop-shadow-2xl">+10s</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-5">
                    <div className="relative">
                      <RotateCcw className="w-14 h-14 text-emerald-400"/>
                      <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-50"></div>
                    </div>
                    <span className="text-4xl font-black text-white drop-shadow-2xl">-10s</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Controlli Video - Design Premium Glassmorphism */}
          <div className={`absolute inset-0 bg-gradient-to-b from-black/90 via-transparent via-50% to-black/95 transition-all duration-700 ${showControls?'opacity-100':'opacity-0 pointer-events-none'}`}>

            {/* Header - Titolo centrato elegante */}
            <div className="absolute top-0 left-0 right-0 p-6 md:p-10 flex justify-center">
              <div className="backdrop-blur-2xl bg-gradient-to-r from-black/40 via-black/30 to-black/40 rounded-3xl px-8 md:px-12 py-6 md:py-8 border border-white/10 shadow-2xl max-w-4xl text-center">
                <h2
                  className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight leading-tight"
                  style={{
                    textShadow: '0 0 20px rgba(16, 185, 129, 0.5), 0 0 40px rgba(16, 185, 129, 0.3), 0 4px 8px rgba(0, 0, 0, 0.8)'
                  }}
                >
                  {playingItem.SeriesName || playingItem.Name}
                </h2>
                {playingItem.SeriesName && (
                  <p className="text-lg md:text-2xl text-gray-100 drop-shadow-lg font-semibold flex items-center justify-center gap-3">
                    <span className="px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-400/30 text-emerald-300">S{playingItem.ParentIndexNumber}</span>
                    <span className="text-emerald-400/50">·</span>
                    <span className="px-3 py-1 bg-emerald-500/20 rounded-full border border-emerald-400/30 text-emerald-300">E{playingItem.IndexNumber}</span>
                    <span className="text-emerald-400/50">·</span>
                    <span className="text-white/90">{playingItem.Name}</span>
                  </p>
                )}
              </div>

              {/* Pulsante chiudi separato */}
              <button
                onClick={closePlayer}
                className="absolute top-6 md:top-10 right-6 md:right-10 bg-black/40 hover:bg-red-500/30 backdrop-blur-2xl rounded-2xl p-4 transition-all duration-300 hover:scale-110 border border-white/10 hover:border-red-500/50 group shadow-2xl"
              >
                <X className="w-7 h-7 text-white group-hover:text-red-400 transition-colors drop-shadow-lg"/>
              </button>
            </div>

            {/* Footer - Controlli completi */}
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
              <div className="backdrop-blur-2xl bg-black/30 rounded-3xl p-6 md:p-8 border border-white/10 shadow-2xl space-y-6">

                {/* Progress Bar Premium */}
                <div className="relative group/progress">
                  {/* Time Display sopra la barra */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm md:text-base font-bold text-white tabular-nums bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                      {formatTime(currentTime)}
                    </span>
                    <span className="text-sm md:text-base font-bold text-gray-400 tabular-nums bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                      {formatTime(duration)}
                    </span>
                  </div>

                  {/* Barra di progresso - con supporto touch */}
                  <div
                    className={isMobile ? "h-6 bg-white/10 rounded-full cursor-pointer backdrop-blur-sm overflow-hidden shadow-inner" : "h-3 bg-white/10 rounded-full cursor-pointer backdrop-blur-sm overflow-hidden transition-all duration-300 group-hover/progress:h-4 shadow-inner"}
                    onMouseDown={e => {
                      setIsDraggingTimeline(true);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const percentage = Math.max(0, Math.min(1, x / rect.width));
                      const seekToTime = percentage * duration;
                      if(videoRef.current && duration) {
                        videoRef.current.currentTime = seekToTime;
                      }
                    }}
                    onMouseMove={e => {
                      if(isDraggingTimeline && videoRef.current && duration) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const seekToTime = percentage * duration;
                        videoRef.current.currentTime = seekToTime;
                      }
                    }}
                    onMouseUp={() => setIsDraggingTimeline(false)}
                    onMouseLeave={() => setIsDraggingTimeline(false)}
                    onTouchStart={e => {
                      setIsDraggingTimeline(true);
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.touches[0].clientX - rect.left;
                      const percentage = Math.max(0, Math.min(1, x / rect.width));
                      const seekToTime = percentage * duration;
                      if(videoRef.current && duration) {
                        videoRef.current.currentTime = seekToTime;
                      }
                    }}
                    onTouchMove={e => {
                      if(isDraggingTimeline && videoRef.current && duration) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.touches[0].clientX - rect.left;
                        const percentage = Math.max(0, Math.min(1, x / rect.width));
                        const seekToTime = percentage * duration;
                        videoRef.current.currentTime = seekToTime;
                      }
                    }}
                    onTouchEnd={() => setIsDraggingTimeline(false)}
                  >
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-400 rounded-full relative transition-all shadow-lg shadow-emerald-500/50"
                      style={{width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`}}
                    >
                      {/* Thumb */}
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-2xl opacity-0 group-hover/progress:opacity-100 transition-all duration-300 ring-4 ring-emerald-400/50 scale-0 group-hover/progress:scale-100"></div>
                      {/* Glow effect */}
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 bg-emerald-400 rounded-full blur-xl opacity-0 group-hover/progress:opacity-60 transition-opacity"></div>
                    </div>
                  </div>
                </div>

                {/* Controlli principali */}
                <div className="flex items-center justify-between flex-wrap gap-4">

                  {/* Lato sinistro - Play/Pause e Skip */}
                  <div className="flex items-center gap-3 md:gap-4">

                    {/* Play/Pause - Premium con glow */}
                    <button
                      onClick={togglePlay}
                      className="relative bg-gradient-to-br from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 rounded-full p-5 transition-all transform hover:scale-110 shadow-2xl shadow-emerald-500/50 group"
                    >
                      {/* Glow ring */}
                      <div className="absolute inset-0 rounded-full bg-emerald-400 blur-xl opacity-0 group-hover:opacity-60 transition-opacity -z-10"></div>
                      {isPlaying ?
                        <Pause className="w-7 h-7 md:w-9 md:h-9 text-white"/> :
                        <Play className="w-7 h-7 md:w-9 md:h-9 text-white fill-current ml-1"/>
                      }
                    </button>

                    {/* Skip -10s */}
                    <button
                      onClick={()=>skip(-10)}
                      className="bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-2xl p-3 md:p-4 transition-all hover:scale-105 border border-white/10 shadow-xl group"
                    >
                      <RotateCcw className="w-5 h-5 md:w-6 md:h-6 group-hover:text-emerald-400 transition-colors"/>
                    </button>

                    {/* Skip +10s */}
                    <button
                      onClick={()=>skip(10)}
                      className="bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-2xl p-3 md:p-4 transition-all hover:scale-105 border border-white/10 shadow-xl group"
                    >
                      <RotateCw className="w-5 h-5 md:w-6 md:h-6 group-hover:text-emerald-400 transition-colors"/>
                    </button>

                    {/* Volume Controls - Solo desktop */}
                    {!isMobile && (
                      <div className="flex items-center gap-3 bg-white/5 backdrop-blur-xl rounded-2xl px-5 py-3 border border-white/10 shadow-xl">
                        <button onClick={toggleMute} className="hover:text-emerald-400 transition-colors group">
                          {isMuted ?
                            <VolumeX className="w-5 h-5 md:w-6 md:h-6"/> :
                            <Volume2 className="w-5 h-5 md:w-6 md:h-6"/>
                          }
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={volume}
                          onChange={handleVolume}
                          className="w-20 md:w-28 h-2 accent-emerald-500 cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, rgb(16 185 129) 0%, rgb(16 185 129) ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%, rgba(255,255,255,0.1) 100%)`
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Lato destro - Audio e Fullscreen */}
                  <div className="flex items-center gap-3 md:gap-4">
                    {/* Selezione traccia audio */}
                    {audioTracks.length > 1 && (
                      <div className="relative">
                        <button
                          onClick={() => {setShowAudioMenu(!showAudioMenu); setShowSubtitleMenu(false); setShowQualityMenu(false);}}
                          className="bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-2xl p-3 md:p-4 transition-all hover:scale-105 border border-white/10 shadow-xl group"
                        >
                          <Languages className="w-5 h-5 md:w-6 md:h-6 group-hover:text-emerald-400 transition-colors"/>
                        </button>

                        {/* Menu tracce audio - Desktop dropdown / Mobile full-screen */}
                        {showAudioMenu && (
                          <div className={isMobile
                            ? "fixed inset-0 bg-black/98 backdrop-blur-3xl z-[100] flex flex-col"
                            : "absolute bottom-full right-0 mb-3 bg-gray-900 backdrop-blur-3xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden min-w-[250px]"
                          }>
                            <div className={isMobile ? "p-6 border-b border-white/10 flex items-center justify-between" : "p-3 border-b border-white/10"}>
                              <h4 className={isMobile ? "text-2xl font-bold text-white" : "text-sm font-bold text-white"}>Traccia Audio</h4>
                              {isMobile && (
                                <button onClick={() => setShowAudioMenu(false)} className="text-white">
                                  <X className="w-8 h-8"/>
                                </button>
                              )}
                            </div>
                            <div className={isMobile ? "flex-1 overflow-y-auto" : "max-h-[300px] overflow-y-auto"}>
                              {audioTracks.map(track => (
                                <button
                                  key={track.index}
                                  onClick={() => changeAudioTrack(track.index)}
                                  className={`w-full text-left transition-colors ${
                                    isMobile ? 'px-6 py-6' : 'px-4 py-3'
                                  } ${
                                    selectedAudioTrack === track.index
                                      ? 'bg-emerald-600/30 text-white border-l-4 border-emerald-500'
                                      : 'hover:bg-white/10 text-gray-300 border-l-4 border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className={isMobile ? "font-medium text-xl" : "font-medium text-sm"}>
                                        {track.displayLanguage}
                                        {track.title && ` - ${track.title}`}
                                      </div>
                                      <div className={isMobile ? "text-base text-gray-400 mt-2" : "text-xs text-gray-500 mt-1"}>
                                        {track.codec.toUpperCase()}
                                      </div>
                                    </div>
                                    {selectedAudioTrack === track.index && (
                                      <div className={isMobile ? "w-4 h-4 bg-emerald-500 rounded-full" : "w-2 h-2 bg-emerald-500 rounded-full"}></div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selezione sottotitoli */}
                    {subtitleTracks.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => {setShowSubtitleMenu(!showSubtitleMenu); setShowAudioMenu(false); setShowQualityMenu(false);}}
                          className="bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-2xl p-3 md:p-4 transition-all hover:scale-105 border border-white/10 shadow-xl group"
                        >
                          <Subtitles className="w-5 h-5 md:w-6 md:h-6 group-hover:text-emerald-400 transition-colors"/>
                        </button>

                        {/* Menu sottotitoli - Desktop dropdown / Mobile full-screen */}
                        {showSubtitleMenu && (
                          <div className={isMobile
                            ? "fixed inset-0 bg-black/98 backdrop-blur-3xl z-[100] flex flex-col"
                            : "absolute bottom-full right-0 mb-3 bg-gray-900 backdrop-blur-3xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden min-w-[250px]"
                          }>
                            <div className={isMobile ? "p-6 border-b border-white/10 flex items-center justify-between" : "p-3 border-b border-white/10"}>
                              <h4 className={isMobile ? "text-2xl font-bold text-white" : "text-sm font-bold text-white"}>Sottotitoli</h4>
                              {isMobile && (
                                <button onClick={() => setShowSubtitleMenu(false)} className="text-white">
                                  <X className="w-8 h-8"/>
                                </button>
                              )}
                            </div>
                            <div className={isMobile ? "flex-1 overflow-y-auto" : "max-h-[300px] overflow-y-auto"}>
                              {/* Opzione Nessuno */}
                              <button
                                onClick={() => changeSubtitleTrack(null)}
                                className={`w-full text-left transition-colors ${
                                  isMobile ? 'px-6 py-6' : 'px-4 py-3'
                                } ${
                                  selectedSubtitleTrack === null
                                    ? 'bg-emerald-600/30 text-white border-l-4 border-emerald-500'
                                    : 'hover:bg-white/10 text-gray-300 border-l-4 border-transparent'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className={isMobile ? "font-medium text-xl" : "font-medium text-sm"}>Nessuno</div>
                                  </div>
                                  {selectedSubtitleTrack === null && (
                                    <div className={isMobile ? "w-4 h-4 bg-emerald-500 rounded-full" : "w-2 h-2 bg-emerald-500 rounded-full"}></div>
                                  )}
                                </div>
                              </button>

                              {/* Tracce sottotitoli */}
                              {subtitleTracks.map(track => (
                                <button
                                  key={track.index}
                                  onClick={() => changeSubtitleTrack(track.index)}
                                  className={`w-full text-left transition-colors ${
                                    isMobile ? 'px-6 py-6' : 'px-4 py-3'
                                  } ${
                                    selectedSubtitleTrack === track.index
                                      ? 'bg-emerald-600/30 text-white border-l-4 border-emerald-500'
                                      : 'hover:bg-white/10 text-gray-300 border-l-4 border-transparent'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <div className={isMobile ? "font-medium text-xl" : "font-medium text-sm"}>
                                        {track.displayLanguage}
                                        {track.title && ` - ${track.title}`}
                                      </div>
                                      <div className={isMobile ? "text-base text-gray-400 mt-2" : "text-xs text-gray-500 mt-1"}>
                                        {track.codec.toUpperCase()}
                                      </div>
                                    </div>
                                    {selectedSubtitleTrack === track.index && (
                                      <div className={isMobile ? "w-4 h-4 bg-emerald-500 rounded-full" : "w-2 h-2 bg-emerald-500 rounded-full"}></div>
                                    )}
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Qualità video */}
                    <div className="relative">
                      <button
                        onClick={() => {setShowQualityMenu(!showQualityMenu); setShowAudioMenu(false); setShowSubtitleMenu(false);}}
                        className="bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-2xl p-3 md:p-4 transition-all hover:scale-105 border border-white/10 shadow-xl group"
                      >
                        <Settings className="w-5 h-5 md:w-6 md:h-6 group-hover:text-emerald-400 transition-colors"/>
                      </button>

                      {/* Menu qualità - Desktop dropdown / Mobile full-screen */}
                      {showQualityMenu && (
                        <div className={isMobile
                          ? "fixed inset-0 bg-black/98 backdrop-blur-3xl z-[100] flex flex-col"
                          : "absolute bottom-full right-0 mb-3 bg-gray-900 backdrop-blur-3xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden min-w-[250px]"
                        }>
                          <div className={isMobile ? "p-6 border-b border-white/10 flex items-center justify-between" : "p-3 border-b border-white/10"}>
                            <h4 className={isMobile ? "text-2xl font-bold text-white" : "text-sm font-bold text-white"}>Qualità video</h4>
                            {isMobile && (
                              <button onClick={() => setShowQualityMenu(false)} className="text-white">
                                <X className="w-8 h-8"/>
                              </button>
                            )}
                          </div>
                          <div className={isMobile ? "flex-1 overflow-y-auto" : "max-h-[300px] overflow-y-auto"}>
                            {[
                              { value: 'auto', label: 'Auto', desc: 'Massima qualità' },
                              { value: '1080p', label: '1080p Full HD', desc: '8 Mbps' },
                              { value: '720p', label: '720p HD', desc: '4 Mbps' },
                              { value: '480p', label: '480p', desc: '1.5 Mbps' },
                              { value: '360p', label: '360p', desc: '0.7 Mbps' }
                            ].map(quality => (
                              <button
                                key={quality.value}
                                onClick={() => changeQuality(quality.value)}
                                className={`w-full text-left transition-colors ${
                                  isMobile ? 'px-6 py-6' : 'px-4 py-3'
                                } ${
                                  selectedQuality === quality.value
                                    ? 'bg-emerald-600/30 text-white border-l-4 border-emerald-500'
                                    : 'hover:bg-white/10 text-gray-300 border-l-4 border-transparent'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className={isMobile ? "font-medium text-xl" : "font-medium text-sm"}>
                                      {quality.label}
                                    </div>
                                    <div className={isMobile ? "text-base text-gray-400 mt-2" : "text-xs text-gray-500 mt-1"}>
                                      {quality.desc}
                                    </div>
                                  </div>
                                  {selectedQuality === quality.value && (
                                    <div className={isMobile ? "w-4 h-4 bg-emerald-500 rounded-full" : "w-2 h-2 bg-emerald-500 rounded-full"}></div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fullscreen */}
                    <button
                      onClick={toggleFull}
                      className="bg-white/5 hover:bg-white/15 backdrop-blur-xl rounded-2xl p-3 md:p-4 transition-all hover:scale-105 border border-white/10 shadow-xl group"
                    >
                      <Maximize className="w-5 h-5 md:w-6 md:h-6 group-hover:text-emerald-400 transition-colors"/>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
