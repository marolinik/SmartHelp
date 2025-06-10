# Политика Безбедности Информационих Система
**PIO Help Desk - Републички фонд за пензијско и инвалидско осигурање**

---

## 1. УВОД И СВРХА

### 1.1 Сврха Документа
Овај документ дефинише политику безбедности информационих система за PIO Help Desk платформу Републичког фонда за пензијско и инвалидско осигурање (у даљем тексту: РФ ПИО). Политика је усклађена са српским прописима о заштити података и информационој безбедности.

### 1.2 Обим Примене
Политика се примењује на:
- Све кориснике PIO Help Desk система
- Све запослене који приступају систему
- Све информационе ресурсе и системе
- Сва мрежна окружења и инфраструктуру
- Све подизвођаче и треће стране са приступом

### 1.3 Правни Оквир
Политика је усклађена са:
- Законом о заштити података о личности (ЗЗЗЛП) - "Службени гласник РС", бр. 87/2018
- Законом о информационој безбедности - "Службени гласник РС", бр. 6/2016, 94/2017, 77/2019
- General Data Protection Regulation (GDPR) - EU Regulation 2016/679
- Интерним актима РФ ПИО

---

## 2. ЦИЉЕВИ БЕЗБЕДНОСТИ

### 2.1 Примарни Циљеви
- **Поверљивост (Confidentiality)**: Заштита информација од неовлашћеног приступа
- **Интегритет (Integrity)**: Очување тачности и потпуности информација
- **Доступност (Availability)**: Обезбеђивање приступа овлашћеним корисницима када је потребно

### 2.2 Секундарни Циљеви
- **Аутентичност**: Потврђивање идентитета корисника и порекла података
- **Неопозорност**: Спречавање порицања извршених акција
- **Одговорност**: Успостављање јасне одговорности за безбедносне мере

---

## 3. ОРГАНИЗАЦИОНА СТРУКТУРА БЕЗБЕДНОСТИ

### 3.1 Улоге и Одговорности

#### Руководилац за Безбедност Информационих Система
- Координирање спровођења безбедносних политика
- Надзор над имплементацијом техничких мера
- Редовно извештавање руководства о стању безбедности

#### Службеник за Заштиту Података (DPO)
- Праћење усклађености са законима о заштити података
- Саветовање о питањима приватности
- Контакт са субјектима података и надзорним органима

#### Системски Администратори
- Имплементација и одржавање техничких безбедносних мера
- Мониторинг система и реаговање на инциденте
- Редовно ажурирање система и патчевање

#### Корисници Система
- Поштовање безбедносних процедура
- Пријављивање сумњивих активности
- Учествовање у обуци о безбедности

### 3.2 Комитет за Информациону Безбедност
Успоставља се Комитет за Информациону Безбедност који чине:
- Заменик директора РФ ПИО (председник)
- Руководилац за Безбедност Информационих Система
- Службеник за Заштиту Података
- Руководилац IT одељења
- Представник правних послова

---

## 4. ТЕХНИЧКЕ БЕЗБЕДНОСНЕ МЕРЕ

### 4.1 Енкрипција и Заштита Података

#### 4.1.1 Енкрипција у Мирању
```
✅ ИМПЛЕМЕНТИРАНО: AES-256 енкрипција
- Локација: encryptionService.ts
- Покривеност: Лични подаци, поверљиви садржај
- Управљање кључевима: Безбедно чување и ротација
```

#### 4.1.2 Енкрипција у Транзиту
```
✅ ИМПЛЕМЕНТИРАНО: TLS 1.3 енкрипција
- Локација: sslService.ts, sslMiddleware.ts
- Покривеност: Све HTTP/WebSocket комуникације
- Сертификати: Валидни SSL сертификати
```

#### 4.1.3 Енкрипција Лозинки
```
✅ ИМПЛЕМЕНТИРАНО: bcrypt хеширање
- Алгоритам: bcrypt са 12 salt rounds
- Локација: encryptionService.ts
- Политика лозинки: Минимум 8 карактера, сложеност
```

### 4.2 Контрола Приступа

#### 4.2.1 Аутентификација
```
✅ ИМПЛЕМЕНТИРАНО: Multi-layer аутентификација
- Локација: auth.ts, authService.ts
- Методе: Username/password, JWT токени
- Session management: Automatic timeout, secure cookies
```

#### 4.2.2 Ауторизација
```
✅ ИМПЛЕМЕНТИРАНО: Role-Based Access Control (RBAC)
- Улоге: admin, l3_expert, l2_specialist, l1_agent, user
- Permissions: Granular permission system
- Access levels: Resource-based access control
```

#### 4.2.3 Мрежна Безбедност
```
✅ ИМПЛЕМЕНТИРАНО: IP и Rate Limiting
- Локација: rateLimitMiddleware.ts, securityService.ts
- IP Whitelisting: CIDR notation подршка
- Rate Limiting: Configurable limits по endpoint-у
- Brute Force Protection: Automated blocking
```

### 4.3 Мониторинг и Audit

#### 4.3.1 Audit Логовање
```
✅ ИМПЛЕМЕНТИРАНО: Comprehensive Audit System
- Локација: auditService.ts, auditMiddleware.ts
- Покривеност: Све системске активности
- Формат: Српски описи, structured JSON
- Retention: Configurable retention policies
```

#### 4.3.2 Безбедносни Мониторинг
```
✅ ИМПЛЕМЕНТИРАНО: Real-time Security Monitoring
- Локација: intrusionDetectionService.ts
- Детекција: Web attacks, scanning, brute force
- Реаговање: Automated blocking, alerting
- Статистике: Real-time threat statistics
```

#### 4.3.3 Здравље Система
```
✅ ИМПЛЕМЕНТИРАНО: System Health Monitoring
- Локација: SystemHealthService.ts
- Метрике: CPU, memory, disk, network
- Алерти: Configurable thresholds
- Извештавање: Serbian-language reports
```

### 4.4 Заштита од Претњи

#### 4.4.1 Детекција Упада (IDS/IPS)
```
✅ ИМПЛЕМЕНТИРАНО: Intrusion Detection/Prevention
- Локација: intrusionDetectionService.ts, idsMiddleware.ts
- Типови: SQL injection, XSS, CSRF, DDoS
- Реаговање: Log, block, alert по severity
- Конфигурација: Flexible rule configuration
```

#### 4.4.2 Vulnerability Scanning
```
✅ ИМПЛЕМЕНТИРАНО: Automated Security Scanning
- Локација: securityScanService.ts, securityScanScheduler.ts
- Типови: Dependencies, code, configuration
- Учесталост: Daily, weekly, on-demand
- Извештавање: Comprehensive Serbian reports
```

#### 4.4.3 Заштита Података
```
✅ ИМПЛЕМЕНТИРАНО: Data Protection Measures
- Локација: dataAnonymizationService.ts
- Anonymization: 6 стратегија, 9 типова података
- Test Environments: Automated anonymization
- Verification: Pattern-based validation
```

---

## 5. ОРГАНИЗАЦИОНЕ БЕЗБЕДНОСНЕ МЕРЕ

### 5.1 Политике и Процедуре

#### 5.1.1 Управљање Приступом
- Процедуре за доделу и опозив приступа
- Редовна провера корисничких налога
- Принцип најмањих потребних привилегија
- Процедуре за привремени приступ

#### 5.1.2 Управљање Инцидентима
- Процедуре за детекцију и пријављивање инцидената
- Реаговање на безбедносне инциденте
- Forensic анализа и документовање
- Post-incident анализа и побољшања

#### 5.1.3 Business Continuity
- Планови за континуитет пословања
- Процедуре за backup и recovery
- Disaster recovery планови
- Тестирање планова за опоравак

### 5.2 Обука и Свесност

#### 5.2.1 Програм Обуке
- Годишња обука о информационој безбедности
- Специјализована обука за администраторе
- Обука о заштити података и приватности
- Тестирање знања и сертификација

#### 5.2.2 Security Awareness
- Редовне safety кампање
- Phishing simulation тестови
- Безбедносни савети и препоруке
- Incident reporting процедуре

### 5.3 Управљање Добављачима

#### 5.3.1 Безбедносни Захтеви
- Security assessment треће стране
- Уговорне безбедносне обавезе
- Редовна провера усклађености
- Управљање приступом подизвођача

---

## 6. УСКЛАЂЕНОСТ И COMPLIANCE

### 6.1 Правни Захтеви

#### 6.1.1 Закон о заштити података о личности (ЗЗЗЛП)
- Спровођење техничких и организационих мера (Члан 24)
- Заштита података по дизајну (Члан 25)
- Евиденција активности обраде (Члан 30)
- Безбедност обраде (Члан 32)
- Обавештавање о нарушавању (Члан 33)

#### 6.1.2 GDPR Compliance
- Data Protection by Design and by Default (Article 25)
- Security of Processing (Article 32)
- Personal Data Breach Notification (Article 33)
- Data Protection Impact Assessment (Article 35)

### 6.2 Аудити и Провере

#### 6.2.1 Интерни Аудити
- Полугодишњи безбедносни аудити
- Compliance провере
- Vulnerability assessments
- Penetration testing

#### 6.2.2 Екстерни Аудити
- Годишњи незавииси безбедносни audit
- Certification assessments
- Regulatory compliance провере
- Third-party security reviews

---

## 7. УПРАВЉАЊЕ РИЗИЦИМА

### 7.1 Процена Ризика

#### 7.1.1 Методологија
- Идентификација assets и претњи
- Анализа ranjivosti
- Процена вероватноће и утицаја
- Калкулација ризика и приоритизација

#### 7.1.2 Risk Treatment
- Митигација ризика
- Прихватање ризика
- Трансфер ризика
- Избегавање ризика

### 7.2 Континуирано Побољшање

#### 7.2.1 Metrics и KPIs
- Security incident rate
- Mean time to detection (MTTD)
- Mean time to response (MTTR)
- Compliance score
- User security awareness

#### 7.2.2 Ажурирање Политика
- Годишња ревизија политика
- Ad-hoc ажурирања по потреби
- Укључивање нових претњи
- Alignment са regulatory changes

---

## 8. ИЗВЕШТАВАЊЕ И КОМУНИКАЦИЈА

### 8.1 Извештавање

#### 8.1.1 Редовни Извештаји
- Месечни безбедносни dashboard
- Квартални compliance reports
- Годишњи risk assessment
- Ad-hoc incident reports

#### 8.1.2 Ескалација
- Хијерархија извештавања
- Критични инциденти - immediate escalation
- Compliance issues - legal department
- Technical issues - IT management

### 8.2 Комуникација

#### 8.2.1 Интерна Комуникација
- Security newsletters
- Policy updates
- Training announcements
- Incident notifications

#### 8.2.2 Екстерна Комуникација
- Regulatory reporting
- Customer notifications
- Vendor communications
- Public relations

---

## 9. ИМПЛЕМЕНТАЦИЈА И СПРОВОЂЕЊЕ

### 9.1 Фазе Имплементације

#### Фаза 1: Техничке Мере (✅ ЗАВРШЕНО)
- Енкрипција и SSL/TLS
- Контрола приступа
- Audit logging
- IDS/IPS системи
- Security scanning

#### Фаза 2: Организационе Мере (🔄 У ТОКУ)
- Документација политика
- Процедуре и шаблони
- Обука запослених
- Compliance framework

#### Фаза 3: Оптимизација (📋 ПЛАНИРАНО)
- Advanced monitoring
- AI-based threat detection
- Automation improvements
- Certification получавање

### 9.2 Успех Метрике

#### Технички KPIs
- 99.9% system availability
- <24h mean incident response time
- 0 critical security vulnerabilities
- 100% encrypted sensitive data

#### Организациони KPIs
- 100% staff security training
- <5% failed security awareness tests
- 100% compliance score
- 0 regulatory violations

---

## 10. КОНТАКТ ИНФОРМАЦИЈЕ

### Одговорни за Безбедност
- **IT Security Manager**: security@pio.rs
- **Data Protection Officer**: dpo@pio.rs
- **System Administrator**: admin@pio.rs
- **Incident Response**: incident@pio.rs

### Emergency Contacts
- **24/7 Security Hotline**: +381-11-XXX-XXXX
- **Management Escalation**: +381-11-XXX-XXXX

---

## ДОКУМЕНТ ИНФОРМАЦИЈЕ

| Поље | Вредност |
|--------|----------|
| **Назив** | Политика Безбедности Информационих Система |
| **Верзија** | 1.0 |
| **Датум** | {{current_date}} |
| **Статус** | Draft |
| **Аутор** | IT Security Team |
| **Одобрио** | [Потребна одобрења] |
| **Следећа ревизија** | {{next_year}} |

---

**НАПОМЕНА:** Овај документ садржи поверљиве информације и намењен је искључиво запосленима РФ ПИО и овлашћеним лицима. Забрањено је дистрибуирање без одобрења.

---

*© 2024 Републички фонд за пензијско и инвалидско осигурање - Сва права задржана* 