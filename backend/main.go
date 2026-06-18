package main

import (
	"fmt"
	"log"
	"os"
	"strings"

	"budgetbridge/internal/auth"
	"budgetbridge/internal/monitor"
	"budgetbridge/internal/pool"
	"budgetbridge/internal/proxy"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Listen            string               `yaml:"listen"`
	FrontendPort      int                  `yaml:"frontend_port"`
	UpstreamURL       string               `yaml:"upstream_url"`
	ModelOverride     string               `yaml:"model_override"`
	PublicURL         string               `yaml:"public_url"`
	Accounts          []pool.AccountConfig `yaml:"accounts"`
	AdminPassword     string               `yaml:"admin_password,omitempty"`
	AdminPasswordHash string               `yaml:"admin_password_hash,omitempty"`
}

func main() {
	data, err := os.ReadFile("config.yaml")
	if err != nil {
		log.Fatalf("config.yaml: %v", err)
	}
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		log.Fatalf("parse config: %v", err)
	}
	if cfg.UpstreamURL == "" {
		cfg.UpstreamURL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
	}
	if cfg.Listen == "" {
		cfg.Listen = ":8080"
	}
	if cfg.FrontendPort == 0 {
		cfg.FrontendPort = 5173
	}

	// Auto-hash plaintext admin_password on first run
	if cfg.AdminPassword != "" {
		hash, err := auth.HashPassword(cfg.AdminPassword)
		if err != nil {
			log.Fatalf("hash admin password: %v", err)
		}
		cfg.AdminPassword = ""
		cfg.AdminPasswordHash = hash
		out, _ := yaml.Marshal(cfg)
		if err := os.WriteFile("config.yaml", out, 0644); err != nil {
			log.Fatalf("save hashed password: %v", err)
		}
		log.Printf("admin_password hashed and saved to config.yaml")
	}

	p := pool.New(cfg.Accounts)
	for i := range cfg.Accounts {
		go monitor.Run(p, i)
	}

	// saver writes pool accounts back to config.yaml on add
	saver := func(cfgs []pool.AccountConfig) error {
		cfg.Accounts = cfgs
		out, err := yaml.Marshal(cfg)
		if err != nil {
			return err
		}
		return os.WriteFile("config.yaml", out, 0644)
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery(), cors.Default())
	r.Use(func(c *gin.Context) {
		log.Printf("[req] %s %s", c.Request.Method, c.Request.URL.Path)
		c.Next()
		log.Printf("[res] %s %s → %d", c.Request.Method, c.Request.URL.Path, c.Writer.Status())
	})

	r.POST("/v1/chat/completions", proxy.Handler(p, cfg.UpstreamURL, cfg.ModelOverride))
	r.POST("/v1/messages", proxy.AnthropicHandler(p, cfg.UpstreamURL, cfg.ModelOverride))
	r.POST("/admin/login", proxy.LoginHandler(cfg.AdminPasswordHash))

	adm := r.Group("/admin")
	adm.Use(auth.Middleware(cfg.AdminPasswordHash))
	adm.GET("/config", func(c *gin.Context) {
		pubURL := cfg.PublicURL
		if pubURL == "" {
			scheme := "http"
			if c.Request.TLS != nil {
				scheme = "https"
			}
			if fwd := c.GetHeader("X-Forwarded-Proto"); fwd != "" {
				scheme = fwd
			}
			host := c.Request.Host
			if idx := strings.Index(host, ":"); idx != -1 {
				host = host[:idx]
			}
			pubURL = fmt.Sprintf("%s://%s:%s", scheme, host, strings.TrimPrefix(cfg.Listen, ":"))
		}
		c.JSON(200, gin.H{"public_url": pubURL})
	})
	adm.GET("/accounts", proxy.ListAccounts(p))
	adm.POST("/accounts", proxy.AddAccount(p, saver))
	adm.DELETE("/accounts", proxy.ClearAccounts(p, saver))
	adm.DELETE("/accounts/:index", proxy.DeleteAccount(p, saver))
	adm.POST("/accounts/:index/toggle", proxy.ToggleAccount(p))
	adm.POST("/accounts/:index/refresh", proxy.RefreshAccount(p))
	adm.POST("/accounts/:index/cooldown/clear", proxy.ClearCooldown(p))

	log.Printf("BudgetBridge on %s (upstream: %s)", cfg.Listen, cfg.UpstreamURL)
	log.Fatal(r.Run(cfg.Listen))
}
