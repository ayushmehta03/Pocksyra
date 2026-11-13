// Package ratelimit is a small in-memory sliding-window limiter.
// It is per-process: if you run several API instances, move this to Redis.
package ratelimit

import (
	"sync"
	"time"
)

type Limiter struct {
	mu     sync.Mutex
	hits   map[string][]time.Time
	limit  int
	window time.Duration
}

func New(limit int, window time.Duration) *Limiter {
	l := &Limiter{hits: make(map[string][]time.Time), limit: limit, window: window}
	go l.janitor()
	return l
}

// Allow records an attempt for key. It returns false and how long to wait
// when the key already has `limit` attempts inside the window.
func (l *Limiter) Allow(key string) (bool, time.Duration) {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	recent := l.prune(key, now)
	if len(recent) >= l.limit {
		l.hits[key] = recent
		return false, recent[0].Add(l.window).Sub(now)
	}
	l.hits[key] = append(recent, now)
	return true, 0
}

// Reset clears a key (e.g. after a successful login).
func (l *Limiter) Reset(key string) {
	l.mu.Lock()
	delete(l.hits, key)
	l.mu.Unlock()
}

func (l *Limiter) prune(key string, now time.Time) []time.Time {
	cutoff := now.Add(-l.window)
	old := l.hits[key]
	i := 0
	for i < len(old) && old[i].Before(cutoff) {
		i++
	}
	return old[i:]
}

func (l *Limiter) janitor() {
	t := time.NewTicker(l.window)
	defer t.Stop()
	for now := range t.C {
		l.mu.Lock()
		for k := range l.hits {
			if r := l.prune(k, now); len(r) == 0 {
				delete(l.hits, k)
			} else {
				l.hits[k] = r
			}
		}
		l.mu.Unlock()
	}
}
