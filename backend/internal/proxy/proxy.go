package proxy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	"budgetbridge/internal/auth"
	"budgetbridge/internal/monitor"
	"budgetbridge/internal/pool"

	"github.com/gin-gonic/gin"
)

var httpClient = &http.Client{Timeout: 5 * time.Minute}

func LoginHandler(passwordHash string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if passwordHash == "" {
			c.JSON(400, gin.H{"error": "auth not configured"})
			return
		}
		var req struct {
			Password string `json:"password"`
		}
		if err := c.ShouldBindJSON(&req); err != nil || req.Password == "" {
			c.JSON(400, gin.H{"error": "password required"})
			return
		}
		if !auth.CheckPassword(passwordHash, req.Password) {
			c.JSON(401, gin.H{"error": "invalid password"})
			return
		}
		c.JSON(200, gin.H{"token": auth.NewToken()})
	}
}

func Handler(p *pool.Pool, upstream, modelOverride string) gin.HandlerFunc {
	url := upstream + "/chat/completions"
	return func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(400, gin.H{"error": "read body"})
			return
		}

		var payload struct {
			Stream bool `json:"stream"`
		}
		json.Unmarshal(body, &payload) //nolint
		sessionKey := c.GetHeader("Authorization")

		if modelOverride != "" {
			var m map[string]json.RawMessage
			if json.Unmarshal(body, &m) == nil {
				m["model"], _ = json.Marshal(modelOverride)
				body, _ = json.Marshal(m)
			}
		}

		for i := 0; i < p.Len(); i++ {
			acc := p.NextForSession(sessionKey)
			if acc == nil {
				break
			}

			req, _ := http.NewRequestWithContext(c.Request.Context(), "POST", url, bytes.NewReader(body))
			req.Header.Set("Authorization", "Bearer "+acc.APIKey)
			req.Header.Set("Content-Type", "application/json")

			resp, err := httpClient.Do(req)
			if err != nil {
				continue
			}

			switch resp.StatusCode {
			case 429:
				resp.Body.Close()
				p.Cooldown(acc, 60*time.Second)
				continue
			case 200:
				defer resp.Body.Close()
				if payload.Stream {
					c.Header("Content-Type", "text/event-stream")
					c.Header("Cache-Control", "no-cache")
					c.Header("X-Accel-Buffering", "no")
					c.Writer.WriteHeader(200)
					fl, _ := c.Writer.(http.Flusher)
					buf := make([]byte, 4096)
					for {
						n, re := resp.Body.Read(buf)
						if n > 0 {
							c.Writer.Write(buf[:n]) //nolint
							if fl != nil {
								fl.Flush()
							}
						}
						if re != nil {
							break
						}
					}
				} else {
					c.DataFromReader(200, resp.ContentLength,
						resp.Header.Get("Content-Type"), resp.Body, nil)
				}
				return
			default:
				// Not an account error — pass upstream response through as-is
				defer resp.Body.Close()
				c.DataFromReader(resp.StatusCode, resp.ContentLength,
					resp.Header.Get("Content-Type"), resp.Body, nil)
				return
			}
		}

		c.JSON(503, gin.H{"error": "no available accounts"})
	}
}

func ClearAccounts(p *pool.Pool, save func([]pool.AccountConfig) error) gin.HandlerFunc {
	return func(c *gin.Context) {
		p.Clear()
		if err := save(p.Configs()); err != nil {
			log.Printf("[warn] save config: %v", err)
		}
		c.JSON(200, gin.H{"ok": true})
	}
}

func AddAccount(p *pool.Pool, save func([]pool.AccountConfig) error) gin.HandlerFunc {
	return func(c *gin.Context) {
		var cfg pool.AccountConfig
		if err := c.ShouldBindJSON(&cfg); err != nil || cfg.APIKey == "" {
			c.JSON(400, gin.H{"error": "api_key is required"})
			return
		}
		if cfg.Alias == "" {
			cfg.Alias = fmt.Sprintf("账号%d", p.Len()+1)
		}
		idx := p.Add(cfg)
		if err := save(p.Configs()); err != nil {
			log.Printf("[warn] save config: %v", err)
		}
		go monitor.CheckBalance(p, idx)
		c.JSON(200, p.All()[idx])
	}
}

func ListAccounts(p *pool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) { c.JSON(200, p.All()) }
}

func ToggleAccount(p *pool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		idx, err := strconv.Atoi(c.Param("index"))
		if err != nil || !p.Toggle(idx) {
			c.JSON(400, gin.H{"error": "invalid index"})
			return
		}
		c.JSON(200, gin.H{"ok": true})
	}
}

func ClearCooldown(p *pool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		idx, err := strconv.Atoi(c.Param("index"))
		if err != nil || !p.ClearCooldown(idx) {
			c.JSON(400, gin.H{"error": "invalid index"})
			return
		}
		c.JSON(200, gin.H{"ok": true})
	}
}

func DeleteAccount(p *pool.Pool, save func([]pool.AccountConfig) error) gin.HandlerFunc {
	return func(c *gin.Context) {
		idx, err := strconv.Atoi(c.Param("index"))
		if err != nil || !p.Remove(idx) {
			c.JSON(400, gin.H{"error": "invalid index"})
			return
		}
		if err := save(p.Configs()); err != nil {
			log.Printf("[warn] save config: %v", err)
		}
		c.JSON(200, gin.H{"ok": true})
	}
}

func RefreshAccount(p *pool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		idx, err := strconv.Atoi(c.Param("index"))
		if err != nil {
			c.JSON(400, gin.H{"error": "invalid index"})
			return
		}
		if err := monitor.CheckBalance(p, idx); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, p.All()[idx])
	}
}
