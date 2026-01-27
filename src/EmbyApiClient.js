/**
 * Professional Emby API Client
 * Based on official Emby REST API documentation
 *
 * @class EmbyApiClient
 */
class EmbyApiClient {
  /**
   * Creates an instance of EmbyApiClient
   * @param {string} baseUrl - The base URL of the Emby server (e.g., 'http://192.168.1.100:8096')
   * @param {string} [apiKey=null] - Optional API key for authentication
   */
  constructor(baseUrl, apiKey = null) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
    this.accessToken = null;
    this.userId = null;
    this.deviceId = this._generateDeviceId();
    this.clientName = 'EmbyWeb';
    this.clientVersion = '1.0.0';
  }

  /**
   * Generates a unique device ID for this client
   * @private
   * @returns {string} Device ID
   */
  _generateDeviceId() {
    let deviceId = localStorage.getItem('emby_device_id');
    if (!deviceId) {
      deviceId = 'emby_web_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('emby_device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Builds the X-Emby-Authorization header
   * @private
   * @returns {string} Authorization header value
   */
  _buildAuthHeader() {
    const parts = [
      `Client="${this.clientName}"`,
      `Device="Web Browser"`,
      `DeviceId="${this.deviceId}"`,
      `Version="${this.clientVersion}"`
    ];

    if (this.accessToken) {
      parts.push(`Token="${this.accessToken}"`);
    }

    return `MediaBrowser ${parts.join(', ')}`;
  }

  /**
   * Makes an HTTP request to the Emby server
   * @private
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<any>} Response data
   */
  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'X-Emby-Authorization': this._buildAuthHeader(),
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      throw new Error(`Emby API Error: ${response.status} ${response.statusText}`);
    }

    // Some endpoints return empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return null;
  }

  /**
   * Builds query string from parameters object
   * @private
   * @param {Object} params - Query parameters
   * @returns {string} Query string
   */
  _buildQueryString(params) {
    const filtered = Object.entries(params)
      .filter(([_, value]) => value !== null && value !== undefined)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}=${value.join(',')}`;
        }
        return `${key}=${encodeURIComponent(value)}`;
      });

    return filtered.length > 0 ? `?${filtered.join('&')}` : '';
  }

  // ==================== AUTHENTICATION ====================

  /**
   * Authenticates user by name and password
   * POST /Users/AuthenticateByName
   *
   * @param {string} username - Username
   * @param {string} password - Password (plain text)
   * @returns {Promise<Object>} AuthenticationResult { User, SessionInfo, AccessToken, ServerId }
   */
  async authenticateByName(username, password) {
    const result = await this._request('/Users/AuthenticateByName', {
      method: 'POST',
      body: JSON.stringify({
        Username: username,
        Pw: password
      })
    });

    // Store credentials for subsequent requests
    this.accessToken = result.AccessToken;
    this.userId = result.User.Id;

    return result;
  }

  /**
   * Gets publicly visible users
   * GET /Users/Public
   *
   * @returns {Promise<Array>} Array of UserDto objects
   */
  async getPublicUsers() {
    return await this._request('/Users/Public');
  }

  /**
   * Sets the access token and user ID manually (for resuming sessions)
   * @param {string} accessToken - Access token
   * @param {string} userId - User ID
   */
  setCredentials(accessToken, userId) {
    this.accessToken = accessToken;
    this.userId = userId;
  }

  // ==================== LIBRARY BROWSING ====================

  /**
   * Gets items from the library with extensive filtering options
   * GET /Users/{UserId}/Items
   *
   * @param {Object} options - Query options
   * @param {string} [options.ParentId] - Parent item ID to browse
   * @param {boolean} [options.Recursive=false] - Whether to search recursively
   * @param {string} [options.SortBy] - Comma-separated sort fields (e.g., 'SortName,ProductionYear')
   * @param {string} [options.SortOrder='Ascending'] - 'Ascending' or 'Descending'
   * @param {Array<string>} [options.IncludeItemTypes] - Item types to include (e.g., ['Movie', 'Series'])
   * @param {Array<string>} [options.Filters] - Filters (e.g., ['IsPlayed', 'IsFavorite'])
   * @param {Array<string>} [options.Fields] - Additional fields to include
   * @param {number} [options.StartIndex=0] - Start index for pagination
   * @param {number} [options.Limit] - Maximum items to return
   * @param {boolean} [options.EnableImages=true] - Include image information
   * @param {boolean} [options.EnableUserData=true] - Include user data
   * @param {number} [options.ImageTypeLimit] - Limit number of image types
   * @param {string} [options.SearchTerm] - Search term
   * @returns {Promise<Object>} QueryResult { Items[], TotalRecordCount }
   */
  async getItems(options = {}) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = {
      ParentId: options.ParentId,
      Recursive: options.Recursive,
      SortBy: options.SortBy,
      SortOrder: options.SortOrder,
      IncludeItemTypes: options.IncludeItemTypes,
      Filters: options.Filters,
      Fields: options.Fields,
      StartIndex: options.StartIndex,
      Limit: options.Limit,
      EnableImages: options.EnableImages,
      EnableUserData: options.EnableUserData,
      ImageTypeLimit: options.ImageTypeLimit,
      SearchTerm: options.SearchTerm
    };

    const queryString = this._buildQueryString(params);
    return await this._request(`/Users/${this.userId}/Items${queryString}`);
  }

  /**
   * Gets items that can be resumed
   * GET /Users/{UserId}/Items/Resume
   *
   * @param {Object} options - Query options (same as getItems)
   * @returns {Promise<Object>} QueryResult { Items[], TotalRecordCount }
   */
  async getResumeItems(options = {}) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = {
      ParentId: options.ParentId,
      Recursive: options.Recursive,
      SortBy: options.SortBy,
      SortOrder: options.SortOrder,
      IncludeItemTypes: options.IncludeItemTypes,
      Fields: options.Fields,
      StartIndex: options.StartIndex,
      Limit: options.Limit,
      EnableImages: options.EnableImages,
      EnableUserData: options.EnableUserData,
      ImageTypeLimit: options.ImageTypeLimit,
      MediaTypes: options.MediaTypes
    };

    const queryString = this._buildQueryString(params);
    return await this._request(`/Users/${this.userId}/Items/Resume${queryString}`);
  }

  /**
   * Gets latest items added to the library
   * GET /Users/{UserId}/Items/Latest
   *
   * @param {Object} options - Query options
   * @param {number} [options.Limit=20] - Maximum items to return
   * @param {string} [options.ParentId] - Parent item ID
   * @param {Array<string>} [options.Fields] - Additional fields
   * @param {Array<string>} [options.IncludeItemTypes] - Item types to include
   * @param {boolean} [options.EnableImages=true] - Include images
   * @param {number} [options.ImageTypeLimit] - Limit image types
   * @returns {Promise<Array>} Array of BaseItemDto objects
   */
  async getLatestItems(options = {}) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = {
      Limit: options.Limit || 20,
      ParentId: options.ParentId,
      Fields: options.Fields,
      IncludeItemTypes: options.IncludeItemTypes,
      EnableImages: options.EnableImages !== false,
      ImageTypeLimit: options.ImageTypeLimit
    };

    const queryString = this._buildQueryString(params);
    return await this._request(`/Users/${this.userId}/Items/Latest${queryString}`);
  }

  /**
   * Gets a specific item by ID
   * GET /Users/{UserId}/Items/{Id}
   *
   * @param {string} itemId - Item ID
   * @param {Array<string>} [fields] - Additional fields to include
   * @returns {Promise<Object>} BaseItemDto object
   */
  async getItem(itemId, fields = null) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = fields ? { Fields: fields } : {};
    const queryString = this._buildQueryString(params);
    return await this._request(`/Users/${this.userId}/Items/${itemId}${queryString}`);
  }

  // ==================== TV SHOWS ====================

  /**
   * Gets seasons for a TV series
   * GET /Shows/{Id}/Seasons
   *
   * @param {string} seriesId - Series ID
   * @param {Object} options - Query options (same as getItems)
   * @returns {Promise<Object>} QueryResult { Items[], TotalRecordCount }
   */
  async getSeasons(seriesId, options = {}) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = {
      UserId: this.userId,
      Fields: options.Fields,
      EnableImages: options.EnableImages,
      EnableUserData: options.EnableUserData,
      ImageTypeLimit: options.ImageTypeLimit
    };

    const queryString = this._buildQueryString(params);
    return await this._request(`/Shows/${seriesId}/Seasons${queryString}`);
  }

  /**
   * Gets episodes for a TV series or season
   * GET /Shows/{Id}/Episodes
   *
   * @param {string} seriesId - Series ID
   * @param {Object} options - Query options
   * @param {number} [options.Season] - Season number
   * @param {string} [options.SeasonId] - Season ID
   * @param {Array<string>} [options.Fields] - Additional fields
   * @returns {Promise<Object>} QueryResult { Items[], TotalRecordCount }
   */
  async getEpisodes(seriesId, options = {}) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = {
      UserId: this.userId,
      Season: options.Season,
      SeasonId: options.SeasonId,
      Fields: options.Fields,
      EnableImages: options.EnableImages,
      EnableUserData: options.EnableUserData,
      ImageTypeLimit: options.ImageTypeLimit,
      StartIndex: options.StartIndex,
      Limit: options.Limit
    };

    const queryString = this._buildQueryString(params);
    return await this._request(`/Shows/${seriesId}/Episodes${queryString}`);
  }

  /**
   * Gets next up episodes
   * GET /Shows/NextUp
   *
   * @param {Object} options - Query options
   * @param {number} [options.Limit=20] - Maximum items
   * @param {number} [options.StartIndex=0] - Start index
   * @param {string} [options.SeriesId] - Filter by series
   * @param {Array<string>} [options.Fields] - Additional fields
   * @returns {Promise<Object>} QueryResult { Items[], TotalRecordCount }
   */
  async getNextUp(options = {}) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = {
      UserId: this.userId,
      Limit: options.Limit || 20,
      StartIndex: options.StartIndex || 0,
      SeriesId: options.SeriesId,
      Fields: options.Fields,
      EnableImages: options.EnableImages,
      EnableUserData: options.EnableUserData,
      ImageTypeLimit: options.ImageTypeLimit
    };

    const queryString = this._buildQueryString(params);
    return await this._request(`/Shows/NextUp${queryString}`);
  }

  // ==================== IMAGES ====================

  /**
   * Builds URL for item image
   * GET /Items/{Id}/Images/{Type}
   *
   * @param {string} itemId - Item ID
   * @param {string} [type='Primary'] - Image type (Primary, Art, Backdrop, Banner, Logo, Thumb, Disc)
   * @param {Object} options - Image options
   * @param {number} [options.MaxWidth] - Maximum width
   * @param {number} [options.MaxHeight] - Maximum height
   * @param {number} [options.Quality=90] - JPEG quality (0-100)
   * @param {string} [options.Tag] - Image tag for caching
   * @param {string} [options.Format] - Output format (jpg, png, webp)
   * @returns {string} Image URL
   */
  getImageUrl(itemId, type = 'Primary', options = {}) {
    const params = {
      MaxWidth: options.MaxWidth,
      MaxHeight: options.MaxHeight,
      Quality: options.Quality || 90,
      Tag: options.Tag,
      Format: options.Format
    };

    const queryString = this._buildQueryString(params);
    return `${this.baseUrl}/Items/${itemId}/Images/${type}${queryString}`;
  }

  /**
   * Gets all image information for an item
   * GET /Items/{Id}/Images
   *
   * @param {string} itemId - Item ID
   * @returns {Promise<Array>} Array of ImageInfo objects
   */
  async getImageInfo(itemId) {
    return await this._request(`/Items/${itemId}/Images`);
  }

  // ==================== SUBTITLES ====================

  /**
   * Builds URL for subtitle stream
   * GET /Videos/{Id}/{MediaSourceId}/Subtitles/{Index}/Stream.{Format}
   *
   * @param {string} itemId - Item ID
   * @param {string} mediaSourceId - Media source ID
   * @param {number} index - Subtitle stream index
   * @param {string} [format='vtt'] - Subtitle format (vtt, srt, etc.)
   * @param {Object} options - Subtitle options
   * @param {number} [options.StartPositionTicks] - Start position
   * @param {number} [options.EndPositionTicks] - End position
   * @param {boolean} [options.CopyTimestamps] - Copy original timestamps
   * @returns {string} Subtitle URL
   */
  getSubtitleUrl(itemId, mediaSourceId, index, format = 'vtt', options = {}) {
    const params = {
      StartPositionTicks: options.StartPositionTicks,
      EndPositionTicks: options.EndPositionTicks,
      CopyTimestamps: options.CopyTimestamps
    };

    const queryString = this._buildQueryString(params);
    return `${this.baseUrl}/Videos/${itemId}/${mediaSourceId}/Subtitles/${index}/Stream.${format}${queryString}`;
  }

  /**
   * Searches for remote subtitles
   * GET /Items/{Id}/RemoteSearch/Subtitles/{Language}
   *
   * @param {string} itemId - Item ID
   * @param {string} language - Language code (e.g., 'eng', 'ita')
   * @param {string} mediaSourceId - Media source ID
   * @param {Object} options - Search options
   * @param {boolean} [options.IsPerfectMatch] - Only perfect matches
   * @param {boolean} [options.IsForced] - Only forced subtitles
   * @param {boolean} [options.IsHearingImpaired] - Only hearing impaired subtitles
   * @returns {Promise<Array>} Array of RemoteSubtitleInfo objects
   */
  async searchSubtitles(itemId, language, mediaSourceId, options = {}) {
    const params = {
      MediaSourceId: mediaSourceId,
      IsPerfectMatch: options.IsPerfectMatch,
      IsForced: options.IsForced,
      IsHearingImpaired: options.IsHearingImpaired
    };

    const queryString = this._buildQueryString(params);
    return await this._request(`/Items/${itemId}/RemoteSearch/Subtitles/${language}${queryString}`);
  }

  /**
   * Downloads remote subtitle
   * POST /Items/{Id}/RemoteSearch/Subtitles/{SubtitleId}
   *
   * @param {string} itemId - Item ID
   * @param {string} subtitleId - Subtitle ID from search results
   * @param {string} mediaSourceId - Media source ID
   * @returns {Promise<Object>} SubtitleDownloadResult { NewIndex }
   */
  async downloadSubtitle(itemId, subtitleId, mediaSourceId) {
    const queryString = this._buildQueryString({ MediaSourceId: mediaSourceId });
    return await this._request(
      `/Items/${itemId}/RemoteSearch/Subtitles/${subtitleId}${queryString}`,
      { method: 'POST' }
    );
  }

  // ==================== USER DATA ====================

  /**
   * Marks item as favorite
   * POST /Users/{UserId}/FavoriteItems/{Id}
   *
   * @param {string} itemId - Item ID
   * @returns {Promise<Object>} UserItemDataDto
   */
  async markFavorite(itemId) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    return await this._request(`/Users/${this.userId}/FavoriteItems/${itemId}`, {
      method: 'POST'
    });
  }

  /**
   * Unmarks item as favorite
   * DELETE /Users/{UserId}/FavoriteItems/{Id}
   *
   * @param {string} itemId - Item ID
   * @returns {Promise<Object>} UserItemDataDto
   */
  async unmarkFavorite(itemId) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    return await this._request(`/Users/${this.userId}/FavoriteItems/${itemId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Updates playback progress
   * POST /Users/{UserId}/PlayingItems/{Id}/Progress
   *
   * @param {string} itemId - Item ID
   * @param {number} positionTicks - Current position in ticks (10000 ticks = 1ms)
   * @param {boolean} [isPaused=false] - Whether playback is paused
   * @returns {Promise<void>}
   */
  async reportPlaybackProgress(itemId, positionTicks, isPaused = false) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = {
      PositionTicks: positionTicks,
      IsPaused: isPaused
    };

    const queryString = this._buildQueryString(params);
    return await this._request(`/Users/${this.userId}/PlayingItems/${itemId}/Progress${queryString}`, {
      method: 'POST'
    });
  }

  /**
   * Reports playback start
   * POST /Users/{UserId}/PlayingItems/{Id}
   *
   * @param {string} itemId - Item ID
   * @param {string} [mediaSourceId] - Media source ID
   * @returns {Promise<void>}
   */
  async reportPlaybackStart(itemId, mediaSourceId = null) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = mediaSourceId ? { MediaSourceId: mediaSourceId } : {};
    const queryString = this._buildQueryString(params);
    return await this._request(`/Users/${this.userId}/PlayingItems/${itemId}${queryString}`, {
      method: 'POST'
    });
  }

  /**
   * Reports playback stopped
   * DELETE /Users/{UserId}/PlayingItems/{Id}
   *
   * @param {string} itemId - Item ID
   * @param {number} positionTicks - Position where playback stopped
   * @returns {Promise<void>}
   */
  async reportPlaybackStopped(itemId, positionTicks) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    const params = { PositionTicks: positionTicks };
    const queryString = this._buildQueryString(params);
    return await this._request(`/Users/${this.userId}/PlayingItems/${itemId}${queryString}`, {
      method: 'DELETE'
    });
  }

  // ==================== PLAYBACK ====================

  /**
   * Gets playback information for an item
   * This includes media sources, streams, and transcoding options
   *
   * @param {string} itemId - Item ID
   * @returns {Promise<Object>} Playback info with MediaSources
   */
  async getPlaybackInfo(itemId) {
    if (!this.userId) {
      throw new Error('User not authenticated');
    }

    return await this._request(`/Items/${itemId}/PlaybackInfo?UserId=${this.userId}`, {
      method: 'POST',
      body: JSON.stringify({ DeviceProfile: {} })
    });
  }

  /**
   * Builds direct stream URL for video playback
   *
   * @param {string} itemId - Item ID
   * @param {string} mediaSourceId - Media source ID
   * @param {Object} options - Playback options
   * @param {string} [options.VideoCodec] - Video codec
   * @param {string} [options.AudioCodec] - Audio codec
   * @param {number} [options.AudioStreamIndex] - Audio stream index
   * @param {number} [options.SubtitleStreamIndex] - Subtitle stream index
   * @param {number} [options.MaxAudioChannels] - Max audio channels
   * @returns {string} Stream URL
   */
  getStreamUrl(itemId, mediaSourceId, options = {}) {
    const params = {
      Static: true,
      MediaSourceId: mediaSourceId,
      DeviceId: this.deviceId,
      api_key: this.accessToken,
      VideoCodec: options.VideoCodec,
      AudioCodec: options.AudioCodec,
      AudioStreamIndex: options.AudioStreamIndex,
      SubtitleStreamIndex: options.SubtitleStreamIndex,
      MaxAudioChannels: options.MaxAudioChannels
    };

    const queryString = this._buildQueryString(params);
    return `${this.baseUrl}/Videos/${itemId}/stream${queryString}`;
  }

  /**
   * Builds HLS master playlist URL for adaptive streaming
   *
   * @param {string} itemId - Item ID
   * @param {string} mediaSourceId - Media source ID
   * @param {Object} options - Streaming options
   * @returns {string} HLS master playlist URL
   */
  getHlsStreamUrl(itemId, mediaSourceId, options = {}) {
    const params = {
      Static: false,
      MediaSourceId: mediaSourceId,
      DeviceId: this.deviceId,
      api_key: this.accessToken,
      ...options
    };

    const queryString = this._buildQueryString(params);
    return `${this.baseUrl}/Videos/${itemId}/master.m3u8${queryString}`;
  }
}

export default EmbyApiClient;
