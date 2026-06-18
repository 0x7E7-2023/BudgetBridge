package pool

import (
	"sync"
	"sync/atomic"
	"time"
)

type AccountConfig struct {
	Alias    string `yaml:"alias"     json:"alias"`
	APIKey   string `yaml:"api_key"   json:"api_key"`
	AKId     string `yaml:"ak_id"     json:"ak_id"`
	AKSecret string `yaml:"ak_secret" json:"ak_secret"`
}

type Account struct {
	AccountConfig
	mu            sync.RWMutex
	Enabled       bool
	Balance       float64
	CouponCount   int
	LastChecked   time.Time
	CooldownUntil time.Time
	RequestCount  int64
}

func (a *Account) IsAvailable() bool {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.Enabled && time.Now().After(a.CooldownUntil)
}

type sessEntry struct {
	acc      *Account
	lastUsed time.Time
}

type Pool struct {
	accounts []*Account
	counter  atomic.Int64
	sessMu   sync.Mutex
	sessions map[string]sessEntry
}

func New(cfgs []AccountConfig) *Pool {
	p := &Pool{sessions: make(map[string]sessEntry)}
	for i := range cfgs {
		p.accounts = append(p.accounts, &Account{AccountConfig: cfgs[i], Enabled: true})
	}
	go func() {
		for range time.Tick(5 * time.Minute) {
			p.sessMu.Lock()
			for k, e := range p.sessions {
				if time.Since(e.lastUsed) > 30*time.Minute {
					delete(p.sessions, k)
				}
			}
			p.sessMu.Unlock()
		}
	}()
	return p
}

func (p *Pool) Len() int { return len(p.accounts) }

func (p *Pool) Get(idx int) *Account {
	if idx < 0 || idx >= len(p.accounts) {
		return nil
	}
	return p.accounts[idx]
}

func (p *Pool) Next() *Account {
	n := len(p.accounts)
	if n == 0 {
		return nil
	}
	start := int(p.counter.Add(1)-1) % n
	for i := range n {
		acc := p.accounts[(start+i)%n]
		if acc.IsAvailable() {
			atomic.AddInt64(&acc.RequestCount, 1)
			return acc
		}
	}
	return nil
}

func (p *Pool) NextForSession(sessionKey string) *Account {
	if sessionKey == "" {
		return p.Next()
	}
	p.sessMu.Lock()
	e, ok := p.sessions[sessionKey]
	if ok {
		if e.acc.IsAvailable() {
			e.lastUsed = time.Now()
			p.sessions[sessionKey] = e
			p.sessMu.Unlock()
			atomic.AddInt64(&e.acc.RequestCount, 1)
			return e.acc
		}
		delete(p.sessions, sessionKey)
	}
	p.sessMu.Unlock()

	acc := p.Next()
	if acc != nil {
		p.sessMu.Lock()
		p.sessions[sessionKey] = sessEntry{acc: acc, lastUsed: time.Now()}
		p.sessMu.Unlock()
	}
	return acc
}

func (p *Pool) Cooldown(acc *Account, d time.Duration) {
	acc.mu.Lock()
	acc.CooldownUntil = time.Now().Add(d)
	acc.mu.Unlock()
}

func (p *Pool) SetBalance(idx int, balance float64, couponCount int) {
	acc := p.Get(idx)
	if acc == nil {
		return
	}
	acc.mu.Lock()
	acc.Balance = balance
	acc.CouponCount = couponCount
	acc.LastChecked = time.Now()
	if balance < 3.0 {
		acc.Enabled = false
	}
	acc.mu.Unlock()
}

func (p *Pool) Toggle(idx int) bool {
	acc := p.Get(idx)
	if acc == nil {
		return false
	}
	acc.mu.Lock()
	acc.Enabled = !acc.Enabled
	acc.mu.Unlock()
	return true
}

func (p *Pool) ClearCooldown(idx int) bool {
	acc := p.Get(idx)
	if acc == nil {
		return false
	}
	acc.mu.Lock()
	acc.CooldownUntil = time.Time{}
	acc.mu.Unlock()
	return true
}

func (p *Pool) Remove(idx int) bool {
	if idx < 0 || idx >= len(p.accounts) {
		return false
	}
	acc := p.accounts[idx]
	// Disable first so Next() won't pick it up
	acc.mu.Lock()
	acc.Enabled = false
	acc.mu.Unlock()
	// Evict any sticky sessions pointing to this account
	p.sessMu.Lock()
	for k, e := range p.sessions {
		if e.acc == acc {
			delete(p.sessions, k)
		}
	}
	p.sessMu.Unlock()
	p.accounts = append(p.accounts[:idx], p.accounts[idx+1:]...)
	return true
}

func (p *Pool) Clear() {
	p.accounts = nil
}

func (p *Pool) Add(cfg AccountConfig) int {
	p.accounts = append(p.accounts, &Account{AccountConfig: cfg, Enabled: true})
	return len(p.accounts) - 1
}

func (p *Pool) Configs() []AccountConfig {
	cfgs := make([]AccountConfig, len(p.accounts))
	for i, acc := range p.accounts {
		acc.mu.RLock()
		cfgs[i] = acc.AccountConfig
		acc.mu.RUnlock()
	}
	return cfgs
}

type Status struct {
	Index        int     `json:"index"`
	Alias        string  `json:"alias"`
	Enabled      bool    `json:"enabled"`
	Available    bool    `json:"available"`
	Balance      float64 `json:"balance"`
	CouponCount  int     `json:"coupon_count"`
	LastChecked  string  `json:"last_checked"`
	CooldownSecs int     `json:"cooldown_secs"`
	RequestCount int64   `json:"request_count"`
}

func (p *Pool) All() []Status {
	result := make([]Status, len(p.accounts))
	for i, acc := range p.accounts {
		acc.mu.RLock()
		cooldown := 0
		if rem := time.Until(acc.CooldownUntil); rem > 0 {
			cooldown = int(rem.Seconds())
		}
		lc := ""
		if !acc.LastChecked.IsZero() {
			lc = acc.LastChecked.Format(time.RFC3339)
		}
		result[i] = Status{
			Index:        i,
			Alias:        acc.Alias,
			Enabled:      acc.Enabled,
			Available:    acc.Enabled && time.Now().After(acc.CooldownUntil),
			Balance:      acc.Balance,
			CouponCount:  acc.CouponCount,
			LastChecked:  lc,
			CooldownSecs: cooldown,
			RequestCount: acc.RequestCount,
		}
		acc.mu.RUnlock()
	}
	return result
}
