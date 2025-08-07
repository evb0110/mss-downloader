# List of Libraries with Geo-Based Blocking / Список библиотек с географическими ограничениями

## Summary / Резюме
This document provides a comprehensive list of manuscript libraries that have geographic restrictions (geo-blocking) or IP-based access limitations. These libraries may require users to be in specific countries or use VPN services to access their content.

Этот документ содержит полный список библиотек рукописей с географическими ограничениями (геоблокировкой) или ограничениями доступа по IP. Для доступа к этим библиотекам может потребоваться находиться в определенных странах или использовать VPN.

---

## 🔴 CONFIRMED GEO-BLOCKED LIBRARIES / ПОДТВЕРЖДЕННЫЕ БИБЛИОТЕКИ С ГЕОБЛОКИРОВКОЙ

### 1. University of Graz (Austria) 🇦🇹
- **URL Pattern:** `unipub.uni-graz.at`, `gams.uni-graz.at`
- **Status:** ✅ Already marked with `geoBlocked: true` in v1.4.96
- **Restrictions:** Access limited to Austrian IPs or requires institutional login
- **Error Messages:** "Cannot connect to University of Graz server. This may be due to network issues or geo-restrictions."
- **Workaround:** VPN with Austrian server or institutional access

### 2. Norwegian National Library (nb.no) 🇳🇴
- **URL Pattern:** `nb.no`
- **Status:** ⚠️ Description mentions geo-restrictions but not marked with flag
- **Restrictions:** Many manuscripts require Norwegian IP for image access
- **Error Messages:** HTTP 403 errors for geo-restricted content
- **Workaround:** VPN with Norwegian server
- **Note:** Some content is publicly accessible, but many manuscripts are Norway-only

### 3. Trinity College Dublin (DIAS/ISOS) 🇮🇪
- **URL Pattern:** `digitalcollections.tcd.ie`
- **Status:** ⚠️ Blocked due to aggressive captcha protection
- **Restrictions:** Captcha/authentication requirements prevent programmatic access
- **Error Messages:** "Trinity College Dublin is not currently supported due to aggressive captcha protection"
- **Workaround:** Manual download only

### 4. Grenoble Municipal Library (France) 🇫🇷
- **URL Pattern:** `pagella.bm-grenoble.fr`
- **Status:** ⚠️ User reported requires VPN (Issue #13)
- **Restrictions:** DNS resolution issues from outside France
- **Error Messages:** "getaddrinfo EAI_AGAIN" errors
- **User Report:** "их сайт работает только через впн" (their site only works through VPN)
- **Workaround:** VPN with French server

---

## 🟡 POTENTIALLY GEO-BLOCKED LIBRARIES / ПОТЕНЦИАЛЬНО ГЕОБЛОКИРОВАННЫЕ БИБЛИОТЕКИ

### 5. MDC Catalonia (Spain) 🇪🇸
- **URL Pattern:** `mdc.csuc.cat`
- **Status:** ⚠️ Timeout errors mention potential regional blocking
- **Restrictions:** May have intermittent access issues from outside Spain
- **Error Messages:** "Connection timeout... This may be due to high server load, network restrictions, or regional blocking"
- **Workaround:** Try different times or Spanish VPN

### 6. BNE - Biblioteca Nacional de España 🇪🇸
- **URL Pattern:** `bdh-rd.bne.es`
- **Status:** ⚠️ SSL bypass needed, may have restrictions
- **Restrictions:** SSL certificate issues may indicate access controls
- **Workaround:** Spanish VPN may help

### 7. Internet Culturale (Italy) 🇮🇹
- **URL Pattern:** `internetculturale.it`
- **Status:** ⚠️ Mentioned in restriction error handling
- **Restrictions:** Some collections may have Italy-only access
- **Workaround:** Italian VPN for restricted content

---

## 📊 STATISTICS / СТАТИСТИКА

- **Total Libraries Supported:** 59
- **Confirmed Geo-Blocked:** 4 (6.8%)
- **Potentially Geo-Blocked:** 3 (5.1%)
- **Total with Restrictions:** 7 (11.9%)

---

## 🛠️ TECHNICAL IMPLEMENTATION / ТЕХНИЧЕСКАЯ РЕАЛИЗАЦИЯ

### Current Implementation (v1.4.96+)
Libraries marked with `geoBlocked: true` display an orange "Geo-Restricted" badge in the UI.

### Required Updates
The following libraries need to be marked with `geoBlocked: true`:
1. Norwegian National Library (nb.no) ✅
2. Grenoble Municipal Library ✅
3. Trinity College Dublin (Note: Currently not supported at all)

### Badge Display
```typescript
// In library definition:
{
  name: 'Library Name',
  example: 'https://...',
  description: '...',
  geoBlocked: true  // This triggers the geo-restriction badge
}
```

---

## 📝 USER GUIDANCE / РУКОВОДСТВО ДЛЯ ПОЛЬЗОВАТЕЛЕЙ

### English
If you encounter access issues with geo-blocked libraries:
1. Try using a VPN service with a server in the library's country
2. Check if your institution provides access
3. Some content may be partially accessible without restrictions
4. Contact the library directly for access options

### Русский
Если у вас возникли проблемы с доступом к геоблокированным библиотекам:
1. Попробуйте использовать VPN-сервис с сервером в стране библиотеки
2. Проверьте, предоставляет ли ваше учреждение доступ
3. Некоторый контент может быть частично доступен без ограничений
4. Обратитесь в библиотеку напрямую для получения вариантов доступа

---

## 📅 LAST UPDATED / ПОСЛЕДНЕЕ ОБНОВЛЕНИЕ
- Date: 2025-08-07
- Version: v1.4.98
- Issue: #20

---

## 🔄 RECOMMENDATIONS / РЕКОМЕНДАЦИИ

1. **Immediate Action:** Mark Norwegian National Library and Grenoble with `geoBlocked: true`
2. **Future Enhancement:** Add detailed geo-restriction information in tooltips
3. **User Experience:** Consider adding VPN recommendation in error messages
4. **Documentation:** Update main README with geo-restriction information