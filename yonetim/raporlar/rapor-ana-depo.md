# Rapor – Ana Depo (23.10.2026, ilk Ana depo oturumu, Cowork)

**Teslim:** `yonetim/belgeler/ana-depo-ozet.md`

**Durum (o oturumda):** HEAD de8ff1e (2.9.12), dal `master`, 75 commit, çalışma ağacı temiz. Testler 2.9.12'de geçti: pytest 103, e2e 250, mobil 42, test/luca tamamı.

## Yöneticinin kararını bekleyen konular
1. 2.9.12 kaynağı D: sürücüsünde yoktu. **Çözüldü:** kaynak artık GitHub deposunda.
2. GitHub erişimi o oturumda yoktu. **Çözüldü:** Ana Depo 2 (Code) depoya bağlı. v2.9.11 ve v2.9.12 sürüm yayınları (`McLk007/muhawin-surumler`) hâlâ yapılmadı.
3. `test/ornek/` içinde gerçek müşteri verisi olabilir. Kullanıcıya sorulacak.
4. Merkezi veri deposu: `belgeler/bulut-veri-tasarimi.md`.

## Eski geçmiş
`git bundle` kullanılmamalı. node_modules yüzünden 182 MB tutuyor. 75 commit'lik geçmiş ilk Ana depo oturumunda arşiv olarak kaldı. GitHub'daki geçmiş, 2.9.12'nin tek kök commit'iyle başlıyor.
