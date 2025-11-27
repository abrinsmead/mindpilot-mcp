import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/electron';

export interface DiagramHistoryEntry {
  version?: number;
  id: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  diagram: string;
  title: string;
  collection: string | null;
}

export interface UseDiagramHistoryOptions {
  searchQuery: string;
  organizeByDate: boolean;
  currentDiagramId?: string | null;
  currentDiagramTitle?: string | null;
  onCurrentDiagramTitleChange?: (newTitle: string) => void;
  refreshTrigger?: number;
}

export function useDiagramHistory({ searchQuery, organizeByDate, currentDiagramId, currentDiagramTitle, onCurrentDiagramTitleChange, refreshTrigger }: UseDiagramHistoryOptions) {
  const [history, setHistory] = useState<DiagramHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set(['Today']));

  // Always fetch history data, regardless of panel state
  // This ensures diagram loading works even when panel is closed
  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  // Update local history when current diagram title changes from outside
  useEffect(() => {
    if (currentDiagramId && currentDiagramTitle) {
      setHistory(prev => prev.map(h => 
        h.id === currentDiagramId ? { ...h, title: currentDiagramTitle } : h
      ));
    }
  }, [currentDiagramId, currentDiagramTitle]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getHistory();
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Delete diagram
  const deleteDiagram = async (entry: DiagramHistoryEntry) => {
    if (!confirm(`Delete "${entry.title}"?`)) {
      return;
    }

    try {
      await api.deleteDiagram(entry.id);
      setHistory(prev => prev.filter(h => h.id !== entry.id));
    } catch (error) {
      console.error('Failed to delete diagram:', error);
      alert('Failed to delete diagram');
    }
  };

  // Rename diagram
  const renameDiagram = async (entry: DiagramHistoryEntry, newTitle: string) => {
    if (!newTitle.trim() || newTitle === entry.title) {
      return;
    }

    try {
      await api.updateDiagram(entry.id, { title: newTitle.trim() });
      setHistory(prev => prev.map(h =>
        h.id === entry.id ? { ...h, title: newTitle.trim() } : h
      ));

      // If this is the currently active diagram, update the diagram context too
      if (currentDiagramId === entry.id && onCurrentDiagramTitleChange) {
        onCurrentDiagramTitleChange(newTitle.trim());
      }
    } catch (error) {
      console.error('Failed to rename diagram:', error);
      alert('Failed to rename diagram');
    }
  };

  // Format date helper
  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks}w ago`;
    
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears}y ago`;
  }, []);

  // Toggle collection
  const toggleCollection = useCallback((collection: string) => {
    setExpandedCollections(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(collection)) {
        newExpanded.delete(collection);
      } else {
        newExpanded.add(collection);
      }
      return newExpanded;
    });
  }, []);

  // Filter history based on search query
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;

    const query = searchQuery.toLowerCase();
    return history.filter(entry =>
      entry.title.toLowerCase().includes(query) ||
      entry.diagram.toLowerCase().includes(query)
    );
  }, [history, searchQuery]);

  // Group diagrams by date
  const dateGroupedHistory = useMemo(() => {
    const groups: Record<string, DiagramHistoryEntry[]> = {};

    filteredHistory.forEach(entry => {
      const date = new Date(entry.updatedAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      let groupName: string;
      if (date.toDateString() === today.toDateString()) {
        groupName = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupName = 'Yesterday';
      } else if (date > lastWeek) {
        groupName = 'This Week';
      } else {
        groupName = 'Older';
      }

      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(entry);
    });

    // Sort diagrams within each group by updatedAt (newest first)
    Object.keys(groups).forEach(group => {
      groups[group].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });

    // Return in a fixed order
    const orderedGroups: [string, DiagramHistoryEntry[]][] = [];
    const groupOrder = ['Today', 'Yesterday', 'This Week', 'Older'];
    groupOrder.forEach(groupName => {
      if (groups[groupName]) {
        orderedGroups.push([groupName, groups[groupName]]);
      }
    });

    return orderedGroups;
  }, [filteredHistory]);

  // Group diagrams by collection and sort collections by most recent diagram
  const collectionGroupedHistory = useMemo(() => {
    const groups: Record<string, DiagramHistoryEntry[]> = {};

    // Group diagrams by collection
    filteredHistory.forEach(entry => {
      const collectionName = entry.collection || 'uncategorized';
      if (!groups[collectionName]) {
        groups[collectionName] = [];
      }
      groups[collectionName].push(entry);
    });

    // Sort diagrams within each collection by updatedAt (newest first)
    Object.keys(groups).forEach(collection => {
      groups[collection].sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });

    // Sort collections by the most recently edited diagram in each collection
    const sortedCollections = Object.entries(groups).sort(([, diagramsA], [, diagramsB]) => {
      // Get the most recent updatedAt date in each collection
      const mostRecentA = Math.max(...diagramsA.map(d => new Date(d.updatedAt).getTime()));
      const mostRecentB = Math.max(...diagramsB.map(d => new Date(d.updatedAt).getTime()));
      // Sort by most recent first
      return mostRecentB - mostRecentA;
    });

    return sortedCollections;
  }, [filteredHistory]);

  // Expand all collections when searching
  useEffect(() => {
    if (searchQuery) {
      const collectionsWithResults = new Set<string>();

      // Find all collections that have matching diagrams
      filteredHistory.forEach(entry => {
        const collectionName = entry.collection || 'uncategorized';
        collectionsWithResults.add(collectionName);
      });

      // Also add date groups if in date mode
      if (organizeByDate) {
        dateGroupedHistory.forEach(([groupName]) => {
          collectionsWithResults.add(groupName);
        });
      }

      setExpandedCollections(collectionsWithResults);
    }
  }, [searchQuery, filteredHistory, organizeByDate, dateGroupedHistory]);

  // Auto-expand the first non-empty group when in date mode
  useEffect(() => {
    if (organizeByDate && dateGroupedHistory.length > 0 && expandedCollections.size === 0) {
      // Find the first group with entries
      const firstNonEmptyGroup = dateGroupedHistory.find(([_, entries]) => entries.length > 0);
      if (firstNonEmptyGroup) {
        setExpandedCollections(new Set([firstNonEmptyGroup[0]]));
      }
    }
  }, [organizeByDate, dateGroupedHistory]);

  // Auto-expand the collection/date group containing the current diagram
  useEffect(() => {
    if (!currentDiagramId || history.length === 0) return;

    // Find the current diagram in history
    const currentEntry = history.find(entry => entry.id === currentDiagramId);
    if (!currentEntry) return;

    if (organizeByDate) {
      // Find which date group contains this diagram
      const date = new Date(currentEntry.updatedAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);

      let groupName: string;
      if (date.toDateString() === today.toDateString()) {
        groupName = 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        groupName = 'Yesterday';
      } else if (date > lastWeek) {
        groupName = 'This Week';
      } else {
        groupName = 'Older';
      }

      // Expand that date group
      setExpandedCollections(prev => new Set([...prev, groupName]));
    } else {
      // Expand the collection containing this diagram
      const collectionName = currentEntry.collection || 'uncategorized';
      setExpandedCollections(prev => new Set([...prev, collectionName]));
    }
  }, [currentDiagramId, history, organizeByDate]);

  // Get nth diagram ID from currently expanded groups (1-indexed)
  const getNthDiagramInExpandedGroups = useCallback((n: number): string | null => {
    const groups = organizeByDate ? dateGroupedHistory : collectionGroupedHistory;
    
    // Collect all diagrams from expanded groups
    const expandedDiagrams: DiagramHistoryEntry[] = [];
    groups.forEach(([groupName, diagrams]) => {
      if (expandedCollections.has(groupName)) {
        expandedDiagrams.push(...diagrams);
      }
    });
    
    // Return the nth diagram ID (1-indexed)
    if (n < 1 || n > expandedDiagrams.length) return null;
    return expandedDiagrams[n - 1].id;
  }, [organizeByDate, dateGroupedHistory, collectionGroupedHistory, expandedCollections]);

  return {
    history: filteredHistory,
    totalDiagrams: history.length,
    loading,
    expandedCollections,
    groupedHistory: organizeByDate ? dateGroupedHistory : collectionGroupedHistory,
    formatDate,
    toggleCollection,
    getNthDiagramInExpandedGroups,
    deleteDiagram,
    renameDiagram,
    refetchHistory: fetchHistory,
  };
}