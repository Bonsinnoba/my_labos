import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SearchIndexItem {
  id: string;
  type: 'project' | 'experiment' | 'finding' | 'resource' | 'note';
  title: string;
  description?: string;
  content?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface SearchResult {
  item: SearchIndexItem;
  score: number;
  highlights: {
    field: string;
    text: string;
  }[];
}

export interface SearchFilters {
  types?: ('project' | 'experiment' | 'finding' | 'resource' | 'note')[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  status?: string[];
  sortBy?: 'relevance' | 'date' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount: number;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: SearchFilters;
  timestamp: number;
}

class SearchService {
  private static instance: SearchService;
  private searchIndex: Map<string, SearchIndexItem> = new Map();
  private searchHistory: SearchHistoryItem[] = [];
  private maxHistoryItems = 20;
  private savedFilters: SavedFilter[] = [];

  private constructor() {
    this.loadIndex();
    this.loadHistory();
    this.loadSavedFilters();
  }

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  // Index Management
  async addToIndex(item: SearchIndexItem): Promise<void> {
    this.searchIndex.set(item.id, item);
    await this.saveIndex();
  }

  async addBatchToIndex(items: SearchIndexItem[]): Promise<void> {
    items.forEach(item => {
      this.searchIndex.set(item.id, item);
    });
    await this.saveIndex();
  }

  async removeFromIndex(id: string): Promise<void> {
    this.searchIndex.delete(id);
    await this.saveIndex();
  }

  async updateIndexItem(item: SearchIndexItem): Promise<void> {
    if (this.searchIndex.has(item.id)) {
      this.searchIndex.set(item.id, item);
      await this.saveIndex();
    }
  }

  async clearIndex(): Promise<void> {
    this.searchIndex.clear();
    await this.saveIndex();
  }

  // Search Functionality
  search(query: string, filters?: SearchFilters): SearchResult[] {
    if (!query.trim()) {
      return [];
    }

    const searchTerms = this.tokenizeQuery(query);
    const results: SearchResult[] = [];

    for (const [id, item] of this.searchIndex.entries()) {
      // Apply type filter
      if (filters?.types && !filters.types.includes(item.type)) {
        continue;
      }

      // Apply date range filter
      if (filters?.dateRange) {
        const itemDate = new Date(item.timestamp);
        if (itemDate < filters.dateRange.start || itemDate > filters.dateRange.end) {
          continue;
        }
      }

      // Apply tag filter
      if (filters?.tags && filters.tags.length > 0) {
        const itemTags = item.tags || [];
        const hasMatchingTag = filters.tags.some(tag => 
          itemTags.some(itemTag => 
            itemTag.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (!hasMatchingTag) {
          continue;
        }
      }

      // Apply status filter
      if (filters?.status && filters.status.length > 0) {
        const itemStatus = item.metadata?.status;
        if (!itemStatus || !filters.status.includes(itemStatus)) {
          continue;
        }
      }

      // Calculate relevance score
      const score = this.calculateRelevanceScore(item, searchTerms);
      
      if (score > 0) {
        const highlights = this.generateHighlights(item, searchTerms);
        results.push({ item, score, highlights });
      }
    }

    // Sort results
    return this.sortResults(results, filters);
  }

  private tokenizeQuery(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 0);
  }

  private calculateRelevanceScore(item: SearchIndexItem, searchTerms: string[]): number {
    let score = 0;
    const titleLower = item.title.toLowerCase();
    const descriptionLower = (item.description || '').toLowerCase();
    const contentLower = (item.content || '').toLowerCase();
    const tagsLower = (item.tags || []).map(t => t.toLowerCase());

    searchTerms.forEach(term => {
      // Title matches (highest weight)
      if (titleLower.includes(term)) {
        score += 10;
        if (titleLower.startsWith(term)) {
          score += 5; // Bonus for prefix match
        }
      } else {
        // Fuzzy match for title
        const fuzzyScore = this.calculateFuzzyScore(titleLower, term);
        if (fuzzyScore > 0.5) {
          score += Math.floor(fuzzyScore * 7);
        }
      }

      // Description matches (medium weight)
      if (descriptionLower.includes(term)) {
        score += 5;
      } else {
        // Fuzzy match for description
        const fuzzyScore = this.calculateFuzzyScore(descriptionLower, term);
        if (fuzzyScore > 0.5) {
          score += Math.floor(fuzzyScore * 3);
        }
      }

      // Content matches (lower weight)
      if (contentLower.includes(term)) {
        score += 3;
      } else {
        // Fuzzy match for content
        const fuzzyScore = this.calculateFuzzyScore(contentLower, term);
        if (fuzzyScore > 0.5) {
          score += Math.floor(fuzzyScore * 2);
        }
      }

      // Tag matches (medium weight)
      if (tagsLower.some(tag => tag.includes(term))) {
        score += 5;
      } else {
        // Fuzzy match for tags
        const tagFuzzyScore = Math.max(...tagsLower.map(tag => this.calculateFuzzyScore(tag, term)));
        if (tagFuzzyScore > 0.5) {
          score += Math.floor(tagFuzzyScore * 3);
        }
      }

      // Exact phrase match (bonus)
      if (titleLower === term) {
        score += 15;
      }
    });

    // Recency bonus (newer items get slight boost)
    const daysSinceCreation = (Date.now() - item.timestamp) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 7) {
      score += 2;
    } else if (daysSinceCreation < 30) {
      score += 1;
    }

    return score;
  }

  private calculateFuzzyScore(text: string, pattern: string): number {
    if (!pattern || pattern.length === 0) return 0;
    if (!text || text.length === 0) return 0;

    // Simple fuzzy matching: check if all characters in pattern appear in text in order
    let patternIndex = 0;
    let textIndex = 0;
    let matches = 0;

    while (patternIndex < pattern.length && textIndex < text.length) {
      if (pattern[patternIndex] === text[textIndex]) {
        matches++;
        patternIndex++;
      }
      textIndex++;
    }

    // Calculate score based on how many characters matched
    const matchRatio = matches / pattern.length;
    
    // Bonus for consecutive matches
    let consecutiveBonus = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    
    patternIndex = 0;
    textIndex = 0;
    
    while (patternIndex < pattern.length && textIndex < text.length) {
      if (pattern[patternIndex] === text[textIndex]) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
        patternIndex++;
      } else {
        currentStreak = 0;
      }
      textIndex++;
    }
    
    consecutiveBonus = (maxStreak / pattern.length) * 0.3;

    return matchRatio + consecutiveBonus;
  }

  private generateHighlights(item: SearchIndexItem, searchTerms: string[]): SearchResult['highlights'] {
    const highlights: SearchResult['highlights'] = [];
    const titleLower = item.title.toLowerCase();
    const descriptionLower = (item.description || '').toLowerCase();
    const contentLower = (item.content || '').toLowerCase();

    searchTerms.forEach(term => {
      if (titleLower.includes(term)) {
        highlights.push({
          field: 'title',
          text: this.highlightText(item.title, term),
        });
      }

      if (descriptionLower.includes(term)) {
        highlights.push({
          field: 'description',
          text: this.highlightText(item.description || '', term),
        });
      }

      if (contentLower.includes(term)) {
        highlights.push({
          field: 'content',
          text: this.highlightText(item.content || '', term),
        });
      }
    });

    return highlights;
  }

  private highlightText(text: string, term: string): string {
    const regex = new RegExp(`(${this.escapeRegex(term)})`, 'gi');
    return text.replace(regex, '**$1**');
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private sortResults(results: SearchResult[], filters?: SearchFilters): SearchResult[] {
    const sortBy = filters?.sortBy || 'relevance';
    const sortOrder = filters?.sortOrder || 'desc';

    return results.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'relevance':
          comparison = b.score - a.score;
          break;
        case 'date':
          comparison = b.item.timestamp - a.item.timestamp;
          break;
        case 'title':
          comparison = a.item.title.localeCompare(b.item.title);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  // Search History
  async addToHistory(query: string, resultCount: number): Promise<void> {
    const historyItem: SearchHistoryItem = {
      query,
      timestamp: Date.now(),
      resultCount,
    };

    // Remove existing entry with same query
    this.searchHistory = this.searchHistory.filter(item => item.query !== query);
    
    // Add new entry at the beginning
    this.searchHistory.unshift(historyItem);
    
    // Limit history size
    if (this.searchHistory.length > this.maxHistoryItems) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistoryItems);
    }

    await this.saveHistory();
  }

  getSearchHistory(): SearchHistoryItem[] {
    return this.searchHistory;
  }

  async clearSearchHistory(): Promise<void> {
    this.searchHistory = [];
    await this.saveHistory();
  }

  async removeFromHistory(query: string): Promise<void> {
    this.searchHistory = this.searchHistory.filter(item => item.query !== query);
    await this.saveHistory();
  }

  // Suggestions
  getSuggestions(query: string, limit: number = 5): string[] {
    if (!query.trim()) {
      return this.searchHistory.slice(0, limit).map(item => item.query);
    }

    const searchTerms = this.tokenizeQuery(query);
    const suggestions = new Set<string>();

    // Get suggestions from history
    this.searchHistory.forEach(item => {
      if (item.query.toLowerCase().includes(query.toLowerCase())) {
        suggestions.add(item.query);
      }
    });

    // Get suggestions from indexed titles
    for (const item of this.searchIndex.values()) {
      const titleLower = item.title.toLowerCase();
      if (searchTerms.some(term => titleLower.includes(term))) {
        suggestions.add(item.title);
      }
    }

    return Array.from(suggestions).slice(0, limit);
  }

  // Persistence
  private async saveIndex(): Promise<void> {
    try {
      const indexArray = Array.from(this.searchIndex.values());
      await AsyncStorage.setItem('@search_index', JSON.stringify(indexArray));
    } catch (error) {
      console.error('Error saving search index:', error);
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const indexData = await AsyncStorage.getItem('@search_index');
      if (indexData) {
        const indexArray: SearchIndexItem[] = JSON.parse(indexData);
        this.searchIndex = new Map(indexArray.map(item => [item.id, item]));
      }
    } catch (error) {
      console.error('Error loading search index:', error);
    }
  }

  private async saveHistory(): Promise<void> {
    try {
      await AsyncStorage.setItem('@search_history', JSON.stringify(this.searchHistory));
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }

  private async loadHistory(): Promise<void> {
    try {
      const historyData = await AsyncStorage.getItem('@search_history');
      if (historyData) {
        this.searchHistory = JSON.parse(historyData);
      }
    } catch (error) {
      console.error('Error loading search history:', error);
    }
  }

  // Statistics
  getIndexStats(): {
    totalItems: number;
    itemsByType: Record<string, number>;
    lastIndexed: number | null;
  } {
    const itemsByType: Record<string, number> = {};
    let lastIndexed: number | null = null;

    for (const item of this.searchIndex.values()) {
      itemsByType[item.type] = (itemsByType[item.type] || 0) + 1;
      if (!lastIndexed || item.timestamp > lastIndexed) {
        lastIndexed = item.timestamp;
      }
    }

    return {
      totalItems: this.searchIndex.size,
      itemsByType,
      lastIndexed,
    };
  }

  // Saved Filters
  async saveFilter(name: string, filters: SearchFilters): Promise<void> {
    const savedFilter: SavedFilter = {
      id: Date.now().toString(),
      name,
      filters,
      timestamp: Date.now(),
    };

    // Remove existing filter with same name
    this.savedFilters = this.savedFilters.filter(f => f.name !== name);
    
    // Add new filter at the beginning
    this.savedFilters.unshift(savedFilter);
    
    await this.saveSavedFilters();
  }

  getSavedFilters(): SavedFilter[] {
    return this.savedFilters;
  }

  async deleteSavedFilter(id: string): Promise<void> {
    this.savedFilters = this.savedFilters.filter(f => f.id !== id);
    await this.saveSavedFilters();
  }

  async updateSavedFilter(id: string, name: string, filters: SearchFilters): Promise<void> {
    const index = this.savedFilters.findIndex(f => f.id === id);
    if (index !== -1) {
      this.savedFilters[index] = {
        ...this.savedFilters[index],
        name,
        filters,
        timestamp: Date.now(),
      };
      await this.saveSavedFilters();
    }
  }

  private async saveSavedFilters(): Promise<void> {
    try {
      await AsyncStorage.setItem('@saved_filters', JSON.stringify(this.savedFilters));
    } catch (error) {
      console.error('Error saving saved filters:', error);
    }
  }

  private async loadSavedFilters(): Promise<void> {
    try {
      const filtersData = await AsyncStorage.getItem('@saved_filters');
      if (filtersData) {
        this.savedFilters = JSON.parse(filtersData);
      }
    } catch (error) {
      console.error('Error loading saved filters:', error);
    }
  }
}

export const searchService = SearchService.getInstance();
