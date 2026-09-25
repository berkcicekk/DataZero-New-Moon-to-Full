# ai.md — DataZero Çalışma Günlüğü

> **Bu dosya AI asistanı (Claude) içindir.** Her oturumun başında **önce bunu oku**, sonunda
> **yapılanları buraya işle**. Amaç: bir sonraki oturumun sıfırdan keşif yapmadan kaldığı
> yerden devam etmesi. İnsan odaklı anlatım `README.md`'de; burası durum + karar kaydı.

**Son güncelleme:** 2026-09-26 (Oturum 3 — **preview deploy TAMAM**, Level 1'in kod
tarafı bitti; yalnızca kullanıcının elle yapacakları kaldı)

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
| Git | TEMİZ, `main` ile `origin/main` senkron |
| Son commit | `5ca1882 docs: record the Preview deployment and its on-chain proof` |
| **Deploy** | **TAMAM — preview'a deploy edildi, zincir üstünde doğrulandı** |
| Contract address | `3e4acbedf8faba89e300173329e6bd8505d252817bf0a3310f5c9e5d5b6ced27` |
| Deploy tx / blok | `691315e59a31426af0a617ad72de884d86e8dd8fb4c6880463b1a784e91057fc` / 1 025 537 |
| README Contract Address tablosu | DOLDURULDU — adres + tx + blok + doğrulama curl'ü |
| README `## Initial Idea` | PLACEHOLDER — **kullanıcı elle dolduracak** |
| README `## Screenshots` | PLACEHOLDER — **kullanıcı elle ekleyecek** |
| `.env` | HAZIR (gitignore'lu) — profil + rastgele `PRIVATE_STATE_PASSWORD` + proof server URL |
| `managed/counter/keys` | VAR — 3 prover (~2.8 MB each) + 3 verifier, deploy proof üretebilir |
| Proof server | Docker Desktop üzerinde çalışıyor (`datazero-proof-server`, :6300) |
| Deploy edilen kontratla etkileşim | HENÜZ DENENMEDİ — `npm run cli` ile openCampaign/attest koşulmadı |

### Level 1 resmî çeklisti (kaynak: `midnight_prompts.pdf` s.4, STEP 7)

| # | Gereksinim | Durum |
|---|------------|-------|
| 1 | Kontrat `compact compile` ile derleniyor | ✅ CI'da (ubuntu runner), çıktı repoda |
| 2 | `managed/` dizini mevcut | ✅ 16 dosya: contract + keys + zkir |
| 3 | 3+ test geçiyor | ✅ **13** test geçiyor (istenenin 4 katı) |
| 4 | Kontrat Preview veya Preprod'a deploy edilmiş | ✅ preview, blok 1 025 537 |
| 5 | Contract address README'de görünüyor | ✅ tx hash + doğrulama komutuyla birlikte |
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

| Araç | Durum (2026-09-26) |
|------|--------------------|
| Compact compiler | Windows'ta YOK — Windows build'i mevcut değil (sadece Linux/macOS) |
| **Docker** | **VAR — Docker Desktop 4.91.0, engine 29.8.0, çalışıyor.** Context: `desktop-linux` |
| WSL | WSL 2 çalışıyor; tek distro **`docker-desktop`** (Docker Desktop'ın kendi distrosu). Ubuntu kurulmadı — **gerek kalmadı** |
| `VirtualMachinePlatform` | **ETKİN** |
| Sanallaştırma (VT-x) | **AÇIK** |
| `gh` CLI | YOK -> CI durumu terminalden doğrulanamıyor |
| Admin yetkisi | **VAR** — `BLUENETWORK\bluen` yerel Administrators üyesi. Sadece oturumlar elevated değil; UAC ile yükseltilebilir. |

> **2026-09-26'da çözüldü:** Makine yeniden başlatıldı ve Docker Desktop kuruldu.
> §6'daki "WSL'e Docker CE kur" planı **terk edildi** — Docker Desktop zaten proof
> server'ı çalıştırıyor. Ubuntu distrosu yalnızca *yerelde Compact derlemek* için
> gerekli olurdu; kontrat değişmediği sürece buna ihtiyaç yok (bkz. aşağıdaki not).

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
çalışan bir **proof server**. Docker Desktop kurulduğu için bu artık sorun değil.

---

## 6. Aktif İş — Preview Deploy

**Hedef:** `npm run deploy -- --network preview` ile contract address almak, README
tablosunu doldurmak, Level 1'i kapatmak.

**Blokaj kalktı (2026-09-26):** Docker Desktop 4.91.0 kurulu ve çalışıyor.
WSL'e Docker CE kurma planı gereksizleşti; `docker compose up -d --wait proof-server`
doğrudan çalışıyor.

### Proof server'ı başlatma

```powershell
npm run proof-server:start     # docker compose up -d --wait proof-server
```

Container adı `datazero-proof-server`, port 6300. `--wait` healthcheck'i bekler
(`/dev/tcp` probe'u, bkz. docker-compose.yml yorumları), "Healthy" yazınca hazır.

### İlerleme

- [x] Reboot yapıldı, **Docker Desktop kuruldu ve çalışıyor**
- [x] `midnightntwrk/proof-server:8.1.0` indirildi, container **healthy**
- [x] `npm test` -> 13/13 geçiyor (Docker kurulumu hiçbir şeyi bozmadı)
- [x] `npm run deploy -- --network preview` çalıştırıldı; preview cüzdanı üretildi,
      24 kelimelik recovery phrase `.midnight-state.json`'a yazıldı
- [x] Kullanıcı faucet'ten fonladı
- [x] **Deploy TAMAMLANDI** — contract address alındı, indexer'dan `ContractDeploy`
      olarak doğrulandı
- [x] README Contract Address tablosu dolduruldu (adres + tx + blok + curl doğrulaması)
- [ ] `## Initial Idea` + Screenshots (**kullanıcı elle**)
- [ ] Rise In submit (**kullanıcı elle**)
- [ ] (opsiyonel) `npm run cli` ile deploy edilmiş kontrat üzerinde openCampaign +
      attest koşup gerçek zincirde çalıştığını göstermek — iyi bir screenshot kaynağı

### Deploy sonucu (2026-09-26)

| | |
|---|---|
| Ağ | preview |
| Contract address | `3e4acbedf8faba89e300173329e6bd8505d252817bf0a3310f5c9e5d5b6ced27` |
| Deploy tx | `691315e59a31426af0a617ad72de884d86e8dd8fb4c6880463b1a784e91057fc` |
| Blok | 1 025 537 |
| Deployer | `mn_addr_preview1mu3x3q4vscpkqk63p36e6ss0qs0s3t5kqjl2epetgvpdyh8rcdgsjd80nm` |

Zincir üstünde bağımsız doğrulama (yerel kurulum gerekmez, `ContractDeploy` döner):

```bash
curl -s https://indexer.preview.midnight.network/api/v4/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ contractAction(address:\"3e4acbedf8faba89e300173329e6bd8505d252817bf0a3310f5c9e5d5b6ced27\") { __typename address transaction { hash block { height } } } }"}'
```

> Indexer şemasında `ContractAction` üzerinde **`chainState` alanı yok** — sorguya
> eklemek `Unknown field` hatası verir. Çalışan alanlar: `__typename`, `address`,
> `state`, `transaction { hash block { height timestamp } }`.

### Preview cüzdanı

```
mn_addr_preview1mu3x3q4vscpkqk63p36e6ss0qs0s3t5kqjl2epetgvpdyh8rcdgsjd80nm
```

Faucet: https://midnight-tmnight-preview.nethermind.dev

Script tNIGHT'ı görene kadar 10 saniyede bir poll eder (varsayılan timeout 10 dk;
`MIDNIGHT_FAUCET_TIMEOUT_MS` ile uzatılabilir — bu oturumda 1 saate çekildi), sonra
DUST kaydı yapıp deploy eder ve contract address'i kutu içinde yazdırır. Adres ayrıca
`.midnight-state.json`'a yazılır.

**Adresi senkronizasyon beklemeden öğrenme:** deploy script'i adresi ancak sync
bittikten sonra yazdırıyor (preview'da ~10 dk sürebilir). Aynı adres `.midnight-state.json`
içindeki seed'den tamamen yerel olarak türetilebilir — `src/wallet.ts`'teki
`HDWallet.fromSeed -> selectAccount(0) -> Roles.NightExternal -> createKeystore ->
getBech32Address()` zinciri, öncesinde `setNetworkId('preview')`. Böyle bir yardımcı
script'i **proje kökünde** çalıştırın; `node_modules` çözümlemesi dosyanın bulunduğu
dizine göre yapıldığı için proje dışındaki bir yoldan çalışmaz.

**Not:** Midnight'ın public/hosted proof server'ı YOK — proof server private witness
işlediği için yerel ve güvenilir olmak zorunda. `MIDNIGHT_PROOF_SERVER_URL` override'ı
sadece farklı bir yerel adres için.

### Yerelde Compact derlemek (opsiyonel, henüz yapılmadı)

Kontratı *değiştirmek* gerekirse Linux compiler'a ihtiyaç var. Docker Desktop zaten
WSL2 kullanıyor ama kendi `docker-desktop` distrosu genel amaçlı değil; ayrı bir
Ubuntu kurup (`wsl --install -d Ubuntu-24.04 --no-launch`) compiler'ı oraya kurmak
gerekir. Kontrat değişmediği sürece gerek yok — CI zaten derliyor.

---

## 7. Bilinen Tuzaklar

- **`StateValue.encode()` yalan söyler.** Map tabanlı ledger state'in içeriğini boş
  döndürüyor. Tam döküm için `toString(false)` kullanın.
- **Sondaki sıfır byte'lar kırpılıyor.** State render edilirken trailing zero'lar
  düşüyor; sabit genişlikli byte araması bu yüzden ~1/256 oranında **sessizce** başarısız
  oluyor. `d6787a5` bunu düzeltti (aramadan önce trailing zero trim).
- `managed/counter/contract` bilerek commit'li — silmeyin, temiz clone'da `npm test`
  bunun üzerinde çalışıyor. `keys/` ve `zkir/` gitignore'lu.
- **Private state dizininin adı `privateStateStoreName` DEĞİL.** `deploy.ts`/`cli.ts`
  `privateStateStoreName: 'datazero-state'` geçiyor ama `levelPrivateStateProvider`
  diske **`midnight-level-db/`** yazıyor; o isim LevelDB *içindeki* bir ad alanı.
  `.gitignore`'daki `*-state/` kalıbı bunu yakalamıyordu -> şifrelenmiş kimlik sırrı
  `git add -A` ile commit edilebilirdi. 2026-09-26'da `midnight-level-db/` hem
  `.gitignore`'a hem de `scripts/clean.mjs` hedeflerine eklendi. Yeni bir provider
  eklerken diskte **gerçekte** hangi dizinin oluştuğunu doğrulayın.

---

## 8. Karar Kaydı

| Tarih | Karar | Gerekçe |
|-------|-------|---------|
| 2026-09-25 | `managed/counter/contract` repo'ya commit edilecek | Jüri/temiz clone Compact toolchain olmadan `npm test` çalıştırabilsin |
| 2026-09-25 | CI artifact'i `if: always()` ile yüklenecek | Test patlasa bile derlenmiş devreler indirilebilsin |
| 2026-09-25 | Public-network deploy'da sadece proof server başlatılacak | Tam devnet (node+indexer) gereksiz ve ağır |
| 2026-09-25 | `ai.md` oturumlar arası hafıza olarak tutulacak | Her oturumda sıfırdan keşif yapılmasın |
| 2026-09-26 | Proof server **Docker Desktop** üzerinde çalıştırılacak, WSL'e Docker CE kurulmayacak | Docker Desktop zaten kurulu ve çalışıyor; tek container için ikinci bir Docker kurulumu gereksiz karmaşıklık |
| 2026-09-26 | README'ye contract address'in yanına tx hash + doğrulama curl'ü eklenecek | Jüri adresi zincir üstünde kendi doğrulayabilsin, yerel kurulum gerekmesin |

---

## 9. Oturum Günlüğü

### 2026-09-26 — Oturum 3 · **Level 1 kod tarafı kapandı**
- Reboot yapılmış ve **Docker Desktop 4.91.0 kurulmuş** bulundu -> WSL'e Docker CE
  kurma planı terk edildi (§6 yeniden yazıldı). Tek WSL distrosu `docker-desktop`.
- `docker compose up -d --wait proof-server` -> imaj indirildi, container **healthy**
- `npm test` -> 13/13 geçti (Docker kurulumu hiçbir şeyi bozmadı)
- `npm run deploy -- --network preview` çalıştırıldı:
  - preview cüzdanı üretildi, recovery phrase `.midnight-state.json`'a yazıldı
  - **cüzdan senkronizasyonu ~11 dakika sürdü** (preview'ın geçmişi uzun) — script'in
    adresi ancak sync sonrası yazdırması bekleme süresini uzatıyor
  - kullanıcı faucet'ten fonladı; fon sync sırasında düştüğü için script faucet
    bekleme bloğunu tamamen atladı ve doğrudan DUST kaydına geçti
  - DUST üretildi, deploy **ilk denemede** başarılı
- **Contract address: `3e4acbedf8faba89e300173329e6bd8505d252817bf0a3310f5c9e5d5b6ced27`**
- Preview indexer'ından bağımsız doğrulama yapıldı: `ContractDeploy`, tx
  `691315e5…`, blok 1 025 537
- README Contract Address tablosu dolduruldu; tx hash, blok ve **çalıştığı test edilmiş**
  bir doğrulama curl komutu eklendi
- Level 1 resmî çeklistinin 7 maddesi de ✅. Kalan: kullanıcının elle yapacakları
  (`## Initial Idea`, screenshot, Rise In submit)

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
