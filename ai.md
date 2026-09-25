# ai.md — DataZero Çalışma Günlüğü

> **Bu dosya AI asistanı (Claude) içindir.** Her oturumun başında **önce bunu oku**, sonunda
> **yapılanları buraya işle**. Amaç: bir sonraki oturumun sıfırdan keşif yapmadan kaldığı
> yerden devam etmesi. İnsan odaklı anlatım `README.md`'de; burası durum + karar kaydı.

**Son güncelleme:** 2026-09-25 (Oturum 2 — WSL kurulumu reboot bekliyor)

---

## 1. Proje Tek Cümlede

DataZero — Midnight üzerinde **gizlilik korumalı reklam attestation** kontratı. Kullanıcı,
kimliğini veya profilini açığa vurmadan bir reklam kampanyasının hedef kitlesine uyduğunu
kanıtlar; reklamveren yalnızca **toplam nitelikli etkileşim sayısını** öğrenir.

- **Yarışma:** Rise In — "Monthly Moonshots on Midnight" builder journey
- **Seviyeler:** Level 1 (New Moon) → Level 6 (Supermoon)
- **Şu anki seviye:** Level 1 · New Moon
- **Repo:** https://github.com/berkcicekk/DataZero-New-Moon-to-Full (main, public)
- **Yerel dizin:** `C:\Users\bluen\OneDrive\Desktop\BERKCİM\projeler\DataZero-New-Moon-to-Full`
- **Git kimliği (repo-local):** `berkcicekk` / `90208101+berkcicekk@users.noreply.github.com`

---

## 2. Mevcut Durum

| Kontrol | Durum |
|---------|-------|
| `npm test` | GEÇİYOR — 13/13 (gerçek derlenmiş devrelerle, in-process) |
| `npm run typecheck` | TEMİZ |
| Git çalışma ağacı | TEMİZ, `main` ile `origin/main` senkron |
| Son commit | `d6787a5 fix(test): trim trailing zeros before searching the public state dump` |
| Deploy | YAPILMADI — `.midnight-state.json` ve `.env` yok |
| README Contract Address tablosu | BOŞ — hâlâ `[PASTE ADDRESS AFTER DEPLOY]` |
| README `## Initial Idea` | PLACEHOLDER — **kullanıcı elle dolduracak** |
| README `## Screenshots` | PLACEHOLDER — **kullanıcı elle ekleyecek** |
| `.env` | HAZIR (gitignore'lu) — profil + rastgele `PRIVATE_STATE_PASSWORD` + proof server URL |
| `managed/counter/keys` | VAR — 3 prover (~2.8 MB each) + 3 verifier, deploy proof üretebilir |

### Level 1 resmî çeklisti (kaynak: `midnight_prompts.pdf` s.4, STEP 7)

| # | Gereksinim | Durum |
|---|------------|-------|
| 1 | Kontrat `compact compile` ile derleniyor | ✅ CI'da (ubuntu runner), çıktı repoda |
| 2 | `managed/` dizini mevcut | ✅ 16 dosya: contract + keys + zkir |
| 3 | 3+ test geçiyor | ✅ **13** test geçiyor (istenenin 4 katı) |
| 4 | Kontrat Preview veya Preprod'a deploy edilmiş | ❌ **KALAN TEK İŞ** |
| 5 | Contract address README'de görünüyor | ❌ #4'e bağlı |
| 6 | README tüm zorunlu bölümleri içeriyor | ✅ 9/9 bölüm doğrulandı |
| 7 | Dosya yapısı spec'e uyuyor | ✅ contracts/ managed/ src/ tests/ .github/workflows/ README.md package.json |

**Spec'in istediği kontrat özellikleri** — hepsi karşılanıyor:
public ledger state ✅ (7 alan), private witness ✅ (`localSecretKey`, `localProfile`),
bilinçli `disclose()` ✅ (3 yerde, gerekçeleri README'de), üstte public/private açıklayan
yorum bloğu ✅. Testler üç alanı da kapsıyor: devre mantığı, state geçişleri, private
input sızmaması.

**Kullanıcının elle yapacakları (spec "DO THIS MANUALLY" diyor):**
- [ ] Faucet'ten cüzdanı fonla (deploy duraklayıp adresi yazdırınca)
- [ ] `## Initial Idea` bölümünü doldur
- [ ] Screenshot ekle: compile çıktısı + deploy edilmiş adres
- [x] 5+ anlamlı commit — **12 commit var**, fazlasıyla yeterli
- [ ] Rise In'de public repo'yu submit et

---

## 3. Mimari / Dosya Haritası

```
contracts/counter.compact     # Compact kontratı (tek dosya, ~8.5KB)
managed/counter/              # compile çıktısı
  contract/                   #   <- COMMIT'Lİ (temiz clone'da npm test çalışsın diye)
  keys/  zkir/                #   <- gitignore'lu (CI artifact'indan gelir)
src/
  witnesses.ts                # private state + witness implementasyonları
  identity.ts                 # yerel kimlik ve profil
  deploy.ts                   # undeployed/preview/preprod deploy
  cli.ts                      # deploy edilmiş kontratla etkileşim menüsü
  setup.ts                    # proof server -> compile -> deploy zinciri
  network.ts                  # ağ konfigürasyonu, cüzdan/deploy state
  wallet.ts                   # cüzdan kurulumu ve sync
  check-balance.ts
tests/
  counter.test.ts             # 13 test
  counter-simulator.ts        # in-process kontrat test yatağı
  utils.ts
.github/workflows/ci.yml      # her push'ta ubuntu'da compile + test + artifact
docker-compose.yml            # proof-server (+ yerel node ve indexer)
scripts/clean.mjs
.compact-version              # 0.31.1
```

### Kontrat yüzeyi

| Devre | Çağıran | İşlev |
|-------|---------|-------|
| `openCampaign(segment, minAge, minScore)` | kampanya sahibi | Kriterleri yayınlar, `CLOSED -> OPEN` |
| `attest()` | herhangi bir kullanıcı | 3 uygunluk şartını private veri üzerinde kanıtlar, nullifier yazar, sayacı artırır |
| `closeCampaign()` | kampanya sahibi | `OPEN -> CLOSED`, sayaç ve nullifier seti korunur |
| `deriveOwnerKey(sk)` | pure | Domain-ayrıştırılmış sahiplik hash'i |
| `deriveNullifier(sk, segment)` | pure | Domain-ayrıştırılmış, kampanyaya bağlı claim etiketi |

**Public ledger:** `campaignOwner: Bytes<32>`, `state: CampaignState`, `campaignSegment: Bytes<32>`,
`minAgeBracket: Uint<8>`, `minEngagement: Uint<16>`, `attestations: Set<Bytes<32>>`,
`totalInteractions: Counter`

**Private witness:** `localSecretKey(): Bytes<32>`, `localProfile(): AudienceProfile`
(`ageBracket`, `interestTag`, `engagementScore`) — hiçbir alanı ledger'a yazılmaz.

**`disclose()` yalnızca 3 yerde:** constructor'da owner key hash'i, `openCampaign`'de
reklamverenin kendi kriterleri, `attest`'te sadece nullifier. Profil alanı hiçbir zaman
disclose edilmez.

---

## 4. Sürüm Sabitleri — SAPMAYIN

| Bileşen | Sürüm |
|---------|-------|
| Compact compiler | `0.31.1` (`.compact-version`) |
| Compact dil sürümü | `pragma language_version >= 0.23` |
| Midnight.js | `4.1.1` (tüm `@midnight-ntwrk/midnight-js-*` paketleri) |
| `@midnight-ntwrk/compact-runtime` | `0.16.0` — midnight-js-protocol'un pinlediği sürüm |
| proof-server image | `midnightntwrk/proof-server:8.1.0` |
| Node | `>= 22` |

---

## 5. Ortam Kısıtları (bu makine)

| Araç | Durum (2026-09-25) |
|------|--------------------|
| Compact compiler | Windows'ta YOK — Windows build'i mevcut değil (sadece Linux/macOS) |
| WSL | WSL **2.7.14.0** (Store/MSIX sürümü) kurulu, çekirdek 6.18.33.2-2. **Distro yok** -> kurulum sürüyor, bkz. §6 |
| `VirtualMachinePlatform` | **ETKİN** (InstallState=1) |
| `Microsoft-Windows-Subsystem-Linux` | Etkinleştirildi ama **reboot bekliyor** (`RebootPending=True`) |
| Sanallaştırma (VT-x) | **AÇIK.** VBS çalışıyor (`VirtualizationBasedSecurityStatus=2`), yani hipervizör ayakta |
| Docker | YOK — ne PATH'te ne Program Files / LOCALAPPDATA altında |
| `gh` CLI | YOK -> CI durumu terminalden doğrulanamıyor |
| Admin yetkisi | **VAR** — `BLUENETWORK\bluen` yerel Administrators üyesi. Sadece oturumlar elevated değil; UAC ile yükseltilebilir. |

> **DÜZELTME:** Önceki notlarda "kullanıcı hesabı admin değil" yazıyordu — **yanlış**.
> Hesap admin grubunda. Ayrıca `Win32_Processor.VirtualizationFirmwareEnabled=False`
> okuması Hyper-V/VBS açıkken **yanıltıcıdır**, VT-x'in kapalı olduğu anlamına gelmez.

**Yetki gerektiren komutlar için:** `Get-WindowsOptionalFeature`, `dism`, `bcdedit` gibi
komutlar elevation ister ve bu oturumda sessizce başarısız olur. Yükseltme gerekmeyen
alternatif: `Get-CimInstance Win32_OptionalFeature` (InstallState: 1=Enabled, 2=Disabled).

**Compact derleme çözümü (çalışıyor):** `.github/workflows/ci.yml` her push'ta ubuntu
runner'da derliyor, test ediyor ve `managed/counter`'ı artifact olarak yüklüyor
(`if: always()` — testler patlasa bile artifact çıkar). Artifact indirilip
`managed/counter`'a açılınca testler ve deploy Windows'ta yerelde çalışır.

**Deploy için Compact GEREKMİYOR** — `managed/counter` mevcutsa yeterli olan tek şey
çalışan bir **proof server**. O da Docker istiyor; asıl blokaj bu.

---

## 6. Aktif İş — WSL2 + Docker Kurulumu

**Hedef:** Proof server'ı ayağa kaldırıp `npm run deploy -- --network preview` ile
contract address almak, README tablosunu doldurmak, Level 1'i kapatmak.

**Seçilen strateji: Docker Desktop DEĞİL, WSL içine Docker CE.**

Gerekçe: Docker Desktop kurulumu ağır ve lisans kısıtları var; ihtiyacımız olan tek şey
tek bir container (proof server). Ubuntu içine `docker-ce` apt ile kurulunca:
- Proof server WSL'de çalışır, **WSL2 localhost forwarding** sayesinde Windows'tan
  `http://127.0.0.1:6300` olarak erişilir (`.env` içindeki `MIDNIGHT_PROOF_SERVER_URL`
  zaten bu adresi bekliyor) — yani `deploy.ts` Windows'ta koşmaya devam edebilir.
- **Bonus:** Compact derleyicisi (Linux binary) aynı WSL'e kurulabilir -> yerelde
  `compact compile` mümkün olur, CI-artifact bağımlılığı ortadan kalkar.

### İlerleme

- [x] Ortam teşhisi: WSL 2.7.14 kurulu, `VirtualMachinePlatform` etkin, VT-x açık,
      hesap admin grubunda
- [x] `wsl --install -d Ubuntu-24.04 --no-launch` çalıştırıldı ->
      `Microsoft-Windows-Subsystem-Linux` özelliği etkinleştirildi,
      **"değişiklikler yeniden başlatmaya kadar etkili olmayacak"**, `RebootPending=True`
- [ ] **<- BURADA KALINDI: makinenin yeniden başlatılması gerekiyor**
- [ ] Reboot sonrası: distro kurulumu
- [ ] Ubuntu içine Docker CE
- [ ] Proof server ayağa kaldır, Windows'tan 6300'ü doğrula
- [ ] (opsiyonel) Compact derleyicisini WSL'e kur
- [ ] Deploy -> contract address -> README tablosu
- [x] `.env` hazırlandı (reboot beklerken) — profil değerleri, 32 karakter rastgele
      `PRIVATE_STATE_PASSWORD`, `MIDNIGHT_PROOF_SERVER_URL=http://127.0.0.1:6300`.
      Cüzdan satırları bilerek boş: ilk `npm run deploy` cüzdanı kendisi üretip
      24 kelimelik recovery phrase'i `.midnight-state.json`'a yazar.

### Deploy adımı (proof server ayağa kalktıktan sonra)

```powershell
npm run deploy -- --network preview
```

Script duraklayıp cüzdan adresini yazdırır -> **kullanıcı faucet'ten fonlar**
(https://midnight-tmnight-preview.nethermind.dev) -> script tNIGHT'ı görene kadar
poll eder, sonra kendi devam eder ve contract address'i kutu içinde yazdırır.
Adres ayrıca `.midnight-state.json`'a yazılır. Oradan README'deki tabloya işlenecek.

**Not:** Midnight'ın public/hosted proof server'ı YOK — proof server private witness
işlediği için yerel ve güvenilir olmak zorunda. Yani Docker'dan kaçış yolu yok,
`MIDNIGHT_PROOF_SERVER_URL` override'ı sadece farklı bir yerel adres için.

### Reboot sonrası çalıştırılacak komutlar

```powershell
# 1) Distro kurulumu. --no-launch SART: ilk acilis interaktif kullanici/parola sorar
#    ve non-interactive oturumda kilitlenir.
wsl --install -d Ubuntu-24.04 --no-launch

# 2) root olarak kullanici olusturmadan ilerle (interaktif OOBE'yi atla)
wsl -d Ubuntu-24.04 -u root -- echo ok
```

```bash
# 3) Docker CE (Ubuntu icinde, root olarak)
wsl -d Ubuntu-24.04 -u root -- bash -lc '
  apt-get update &&
  apt-get install -y ca-certificates curl &&
  install -m 0755 -d /etc/apt/keyrings &&
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc &&
  chmod a+r /etc/apt/keyrings/docker.asc &&
  echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu noble stable" > /etc/apt/sources.list.d/docker.list &&
  apt-get update &&
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin'

# 4) Docker daemon'i baslat (WSL'de systemd olmayabilir -> dogrudan dockerd)
wsl -d Ubuntu-24.04 -u root -- bash -lc 'dockerd > /var/log/dockerd.log 2>&1 &'
wsl -d Ubuntu-24.04 -u root -- docker version

# 5) Proof server
wsl -d Ubuntu-24.04 -u root -- docker run -d --name datazero-proof-server \
  -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
```

```powershell
# 6) Windows tarafindan dogrula
curl.exe -sS http://127.0.0.1:6300/health
```

**Dikkat:** WSL'de systemd varsayılan olarak kapalıysa `systemctl start docker`
çalışmaz. `/etc/wsl.conf` içine `[boot]\nsystemd=true` yazıp `wsl --shutdown` ile
yeniden başlatmak kalıcı çözüm; hızlı yol yukarıdaki doğrudan `dockerd &`.

---

## 7. Bilinen Tuzaklar

- **`StateValue.encode()` yalan söyler.** Map tabanlı ledger state'in içeriğini boş
  döndürüyor. Tam döküm için `toString(false)` kullanın.
- **Sondaki sıfır byte'lar kırpılıyor.** State render edilirken trailing zero'lar
  düşüyor; sabit genişlikli byte araması bu yüzden ~1/256 oranında **sessizce** başarısız
  oluyor. `d6787a5` bunu düzeltti (aramadan önce trailing zero trim).
- `managed/counter/contract` bilerek commit'li — silmeyin, temiz clone'da `npm test`
  bunun üzerinde çalışıyor. `keys/` ve `zkir/` gitignore'lu.

---

## 8. Karar Kaydı

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-09-25 | `managed/counter/contract` repo'ya commit edilecek | Jüri/temiz clone Compact toolchain olmadan `npm test` çalıştırabilsin |
| 2026-09-25 | CI artifact'i `if: always()` ile yüklenecek | Test patlasa bile derlenmiş devreler indirilebilsin |
| 2026-09-25 | Public-network deploy'da sadece proof server başlatılacak | Tam devnet (node+indexer) gereksiz ve ağır |
| 2026-09-25 | `ai.md` oturumlar arası hafıza olarak tutulacak | Her oturumda sıfırdan keşif yapılmasın |

---

## 9. Oturum Günlüğü

### 2026-09-25 — Oturum 2
- Proje durumu doğrulandı: testler 13/13 geçiyor, typecheck temiz, git senkron
- **Yeni tespit:** Docker bu makinede kurulu *değil* — önceki notta "Docker'daki proof
  server yeterli" yazıyordu ama Docker'ın kendisi yok. Deploy gerçekten bloke.
- `gh` CLI de yok, CI durumu doğrulanamadı
- `ai.md` (bu dosya) + `CLAUDE.md` oluşturuldu — oturumlar arası hafıza mekanizması
- **Ortam teşhisi düzeltmeleri:**
  - Hesap **admin grubunda** (önceki "admin değil" notu yanlıştı)
  - `VirtualMachinePlatform` zaten etkin, VT-x açık (VBS çalışıyor)
  - WSL 2.7.14 kurulu ama distro yok
- `wsl --install -d Ubuntu-24.04 --no-launch` çalıştırıldı -> WSL optional feature
  etkinleştirildi, **reboot bekliyor**
- **Oturum burada kesildi: kullanıcının makineyi yeniden başlatması gerekiyor.**
  Reboot sonrası yapılacaklar §6'da komut komut yazılı.

### 2026-09-25 — Oturum 1
- Level 1 sıfırdan kuruldu: toolchain, `counter.compact`, 13 testlik suite, deploy ve
  CLI scriptleri, CI, README (gizlilik modeli dahil)
- Compact'in Windows'ta derlenememesi keşfedildi, CI-artifact yoluna geçildi
- `StateValue.encode()` ve trailing-zero tuzakları bulunup test düzeltmeleri yapıldı
