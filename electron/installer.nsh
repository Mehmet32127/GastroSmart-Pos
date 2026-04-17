; GastroSmart POS — Custom NSIS Installer Script
; Kurulum sırasında "Admin Şifre Sıfırla" kısayollarını ekler.

!macro customInstall
  ; Başlat Menüsü kısayolu
  CreateShortCut "$SMPROGRAMS\GastroSmart POS - Admin Şifre Sıfırla.lnk" \
    "$INSTDIR\Admin-Sifre-Sifirla.bat"

  ; Masaüstü kısayolu — acil durumda kolay erişim için
  CreateShortCut "$DESKTOP\GastroSmart - Admin Şifre Sıfırla.lnk" \
    "$INSTDIR\Admin-Sifre-Sifirla.bat"
!macroend

!macro customUnInstall
  Delete "$SMPROGRAMS\GastroSmart POS - Admin Şifre Sıfırla.lnk"
  Delete "$DESKTOP\GastroSmart - Admin Şifre Sıfırla.lnk"
!macroend
