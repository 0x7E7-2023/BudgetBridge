package auth

import (
	"crypto/rand"
	"encoding/hex"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

var (
	mu     sync.Mutex
	tokens = map[string]time.Time{}
)

func HashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), 10)
	return string(b), err
}

func CheckPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

func NewToken() string {
	b := make([]byte, 16)
	rand.Read(b) //nolint
	t := hex.EncodeToString(b)
	mu.Lock()
	tokens[t] = time.Now().Add(24 * time.Hour)
	mu.Unlock()
	return t
}

func Valid(token string) bool {
	mu.Lock()
	exp, ok := tokens[token]
	mu.Unlock()
	return ok && time.Now().Before(exp)
}

// Middleware protects routes with Bearer token auth.
// If passwordHash is empty, auth is disabled (backward-compat).
func Middleware(passwordHash string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if passwordHash == "" {
			c.Next()
			return
		}
		token := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !Valid(token) {
			c.JSON(401, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Next()
	}
}
