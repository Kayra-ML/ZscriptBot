<div align="center">
  <img src="assets/banner.png" alt="ZscriptBot Banner" width="100%" />
  
  <h1>ZscriptBot - Ultimate Discord Companion</h1>
  <p><strong>Gelişmiş bilet (ticket) sistemi, ürün satışı, lisans yönetimi ve abonelik sistemine sahip modern Discord botu.</strong></p>

  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" />
  <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" />
  <img src="https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
</div>

<br />

## 🌟 Özellikler

- **🎫 Gelişmiş Bilet (Ticket) Sistemi:** Destek, Satış, İşbirliği ve Özel kategorilerde ozel bilet oluşturma, otomatik transcript alma ve gelismis yetkilendirme paneli.
- **🛒 Ürün ve Satış:** Discord üzerinden ürün sergileme, lisans anahtarı satışı ve otomatik teslimat.
- **🔄 Abonelik Sistemi:** Kullanıcılara süreli abonelik (Rol) verme, abonelik dondurma, uzatma ve iptal etme özellikleri.
- **🔐 Lisans Yönetimi:** Ürün satışları için otomatik oluşturulan, takip edilebilir lisans anahtarı havuzu.
- **🛡️ Gelişmiş Admin Paneli:** Tüm ayarları (Bilet kategorileri, arşiv kanalları vs.) Discord içerisinden `/kurulum` komutu ile görsel arayüzle yapılandırma.
- **⚡ Yüksek Performans:** TypeScript, Discord.js v14, PostgreSQL (Prisma ORM) ve Redis Cache ile desteklenmiş ölçeklenebilir altyapı. Tamamen Dockerize edilmiştir.

## 🚀 Kurulum

Projeyi kendi sunucunuzda çalıştırmak için aşağıdaki adımları izleyin.

### Gereksinimler

- Node.js (v18+)
- Docker & Docker Compose
- Discord Bot Token & Client ID

### Adımlar

1. **Repoyu Klonlayın:**
   ```bash
   git clone https://github.com/Kayra-ML/ZscriptBot.git
   cd ZscriptBot
   ```

2. **Çevresel Değişkenleri Ayarlayın:**
   ```bash
   cp .env.example .env
   ```
   `.env` dosyanızı açın ve aşağıdaki bilgileri doldurun:
   ```env
   DISCORD_TOKEN=sizin_bot_tokeniniz
   CLIENT_ID=sizin_bot_client_id_niz
   DATABASE_URL=postgresql://zscript:zscript@postgres:5432/zscript
   REDIS_URL=redis://redis:6379
   GUILD_ID=sizin_sunucu_id_niz  # Komutların hızlı yüklenmesi için opsiyonel
   ```

3. **Docker ile Başlatın:**
   Tüm veritabanı (Postgres + Redis) ve bot altyapısı Docker Compose ile tek komutta kalkar.
   ```bash
   docker compose up --build -d
   ```

4. **Botu Kurun:**
   Discord sunucunuza botu davet ettikten sonra **Yönetici (Administrator)** yetkisine sahip bir hesap ile `/kurulum panel` komutunu kullanarak botun çalışacağı kanalları ve kategorileri ayarlayın.

## 🛠️ Kullanılan Teknolojiler

- **Dil:** TypeScript
- **Kütüphane:** Discord.js v14
- **Veritabanı:** PostgreSQL
- **ORM:** Prisma
- **Önbellek:** Redis
- **Dağıtım:** Docker & Docker Compose

## 📄 Lisans
Bu proje özel kullanım için geliştirilmiştir.
