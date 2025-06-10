# Процедуре за Безбедносне Инциденте
**PIO Help Desk - Републички фонд за пензијско и инвалидско осигурање**

---

## 1. ОПШТИ ДЕО

### 1.1 Сврха и Циљ
Ове процедуре дефинишу начин поступања у случају безбедносних инцидената и нарушавања заштите података у PIO Help Desk систему. Циљ је брза детекција, одговор и решавање инцидената уз минимизацију штете.

### 1.2 Обим Примене
Процедуре се примењују на:
- Све безбедносне инциденте
- Нарушавања заштите личних података
- Системске кварове са безбедносним импликацијама
- Сумњиве активности у систему

### 1.3 Дефиниције

#### Безбедносни Инцидент
Сваки догађај који угрожава поверљивост, интегритет или доступност информационих ресурса.

#### Нарушавање Заштите Података
Нарушавање безбедности које доводи до случајног или неправног уништавања, губитка, измене, неовлашћеног откривања или приступа личним подацима.

#### Критични Инцидент
Инцидент са високим ризиком по безбедност система или права субјеката података.

---

## 2. КЛАСИФИКАЦИЈА ИНЦИДЕНАТА

### 2.1 Нивои Озбиљности

#### Ниво 1 - КРИТИЧНИ (CRITICAL)
- **Дефиниција**: Масовно нарушавање података, напад на инфраструктуру
- **Пример**: Data breach са >1000 корисника, ransomware напад
- **Време одговора**: Тренутно (у року од 15 минута)
- **Ескалација**: Сходство директора, DPO, правни послови

#### Ниво 2 - ВИСОК (HIGH) 
- **Дефиниција**: Значајно угрожавање безбедности или неколико корисника
- **Пример**: Неовлашћен приступ admin налогу, SQL injection
- **Време одговора**: 1 сат
- **Ескалација**: IT руководство, DPO

#### Ниво 3 - СРЕДЊИ (MEDIUM)
- **Дефиниција**: Ограничено угрожавање, један корисник
- **Пример**: Фишинг имејл, malware детекција
- **Време одговора**: 4 сата
- **Ескалација**: IT администратор

#### Ниво 4 - НИЗАК (LOW)
- **Дефиниција**: Мала претња, нема директан утицај на податке
- **Пример**: Неуспешан брute force напад, подозрива активност
- **Време одговора**: 24 сата
- **Ескалација**: Нема аутоматску ескалацију

### 2.2 Типови Инцидената

#### Безбедносни Инциденти
- **Неовлашћен приступ** система или података
- **Malware** инфекције
- **DDoS/DoS** напади
- **Social engineering** напади
- **Insider threats** - унутрашње претње

#### Инциденти Заштите Података
- **Data breach** - неовлашћено откривање података
- **Data loss** - губитак или уништавање података
- **Неправна обрада** - кршење ЗЗЗЛП/GDPR
- **Системски кварови** који утичу на заштиту

#### Технички Инциденти
- **Системски кварови** који угрожавају безбедност
- **Мрежни инциденти** - проблеми са конекцијом
- **Backup failуре** - неуспех резервних система
- **Конфигурациони проблеми** - безбедносни gaps

---

## 3. INCIDENT RESPONSE TEAM (IRT)

### 3.1 Састав Тима

#### Incident Commander (IC) - Руководилац Инцидента
- **Улога**: Координација, одлучивање, комуникација
- **Одговорност**: Управљање инцидентом од почетка до краја
- **Контакт**: incident-commander@pio.rs

#### Security Analyst - Аналитичар Безбедности  
- **Улога**: Техничка анализа, форензика
- **Одговорност**: Детекција, анализа, митигација
- **Контакт**: security-analyst@pio.rs

#### Data Protection Officer (DPO)
- **Улога**: Compliance, права субјеката, legal аспекти
- **Одговорност**: ЗЗЗЛП/GDPR compliance, известување надзорних органа
- **Контакт**: dpo@pio.rs

#### System Administrator
- **Улога**: Техничка имплементација, системи
- **Одговорност**: Операционални одговор, system recovery
- **Контакт**: sysadmin@pio.rs

#### Communications Lead
- **Улога**: Интерна и екстерна комуникација
- **Одговорност**: Обавештавање stakeholder-а, media response
- **Контакт**: communications@pio.rs

### 3.2 Контакт Информације

#### 24/7 Emergency Hotline
- **Телефон**: +381-11-2017-9999
- **Email**: security-incident@pio.rs
- **SMS Alert**: +381-64-XXX-XXXX

#### Ескалација Руководству
- **IT Director**: +381-64-XXX-XXXX
- **Deputy Director**: +381-64-XXX-XXXX
- **Legal Counsel**: +381-64-XXX-XXXX

---

## 4. ФАЗЕ INCIDENT RESPONSE

### 4.1 Фаза 1: ДЕТЕКЦИЈА И АНАЛИЗА

#### 4.1.1 Аутоматска Детекција
```
✅ ИМПЛЕМЕНТИРАНО: Automated Detection Systems
- IDS/IPS системи (intrusionDetectionService.ts)
- Security scanning (securityScanService.ts)
- System health monitoring (SystemHealthService.ts)
- Audit logging (auditService.ts)
```

#### 4.1.2 Манулна Детекција
- **User Reports**: Пријаве корисника
- **Admin Observation**: Запажања администратора
- **External Notification**: Обавештења спољних субјеката
- **Routine Checks**: Рутинске провере

#### 4.1.3 Први Одговор (First Response)
1. **Пријем пријаве** (у року од 5 минута):
   ```
   □ Забележити време пријаве
   □ Идентификовати извештач
   □ Прикупити основне информације
   □ Доделити incident ID
   ```

2. **Первична класификација** (у року од 15 минута):
   ```
   □ Одредити ниво озбиљности
   □ Класификовати тип инцидента
   □ Активирати одговарајући тим
   □ Известити IC (Incident Commander)
   ```

3. **Валидација инцидента** (у року од 30 минута):
   ```
   □ Потврдити да је инцидент реалан
   □ Прикупити додатне доказе
   □ Документовати налази
   □ Одлучити о даљим корацима
   ```

### 4.2 Фаза 2: КОНZАЈНАЊЕ И EРАДИКАЦИЈА

#### 4.2.1 Containment Strategy

##### Краткорочно Конzајнање (Short-term)
- **Циљ**: Зауставити ширење инцидента
- **Време**: У року од 1 сата за критичне
- **Мере**:
  ```
  □ Изоловати компромитоване системе
  □ Блокирати сумњиве IP адресе
  □ Дезактивирати компромитоване налоге
  □ Забранити приступ sensitive подацима
  ```

##### Дугорочно Конzајнање (Long-term)
- **Циљ**: Темпорално решење док се не изведе cleanup
- **Време**: У року од 4 сата
- **Мере**:
  ```
  □ Поставити временске заштитне мере
  □ Имплементирати emergency patches
  □ Активирати backup системе
  □ Поставити additional monitoring
  ```

#### 4.2.2 Evidence Collection - Прикупљање Доказа

##### Digitalna Forenzika
```
□ Kreirati forensic images пре било каквих промена
□ Сакупити логове из свих релевантних система
□ Забележити network traffic са времenom инцидента
□ Документовати sve systemске промене
□ Сачувати volatile memory ако је могуће
```

##### Документовање
```
□ Фотографије/screenshot-ови система
□ Детаљан timeline активности
□ List свих лица која су имала приступ
□ Копије свих релевантних файлова
□ Записници разговора са сведоцима
```

#### 4.2.3 Eradication - Елиминација

##### Уклањање Претње
```
□ Обрисати malware и повезане файлове
□ Disabilovati kompromiтоване accesso
□ Patch security vulnerabilities
□ Ажурирати security configurations
□ Променити kompromiтоване credentials
```

##### System Hardening
```
□ Применити security updates
□ Ревидовати и pojačati access controls
□ Ажурирати firewall правила
□ Појачати monitoring capabilities
□ Имплементирати additional security мере
```

### 4.3 Фаза 3: ОПОРАВАК (RECOVERY)

#### 4.3.1 System Restoration
```
□ Вратити системе из чистих backup-а
□ Тестирати system functionality
□ Верификовати security мере
□ Постепено враћати normal operations
□ Мониторирати за signs of continued compromise
```

#### 4.3.2 Validation Testing
```
□ Провера да је претња елиминисана
□ Функционални тестови свих система
□ Security vulnerability scanning
□ Penetration testing ако је потребно
□ User acceptance testing
```

#### 4.3.3 Ретурн то Production
```
□ Координирати са business stakeholders
□ Комуницирати timeline корисницима
□ Мониторирати system performance
□ Одржавати појачане security мере
□ Документовати lessons learned
```

### 4.4 Фаза 4: POST-INCIDENT ACTIVITY

#### 4.4.1 Извештавање и Документовање

##### Incident Report
**Шаблон за Финални Извештај:**
```
INCIDENT REPORT - {{INCIDENT_ID}}

1. EXECUTIVE SUMMARY
   - Кратак опис инцидента
   - Утицај на business operations
   - Ключни налази и recommendations

2. INCIDENT TIMELINE
   - Детаљан chronolški преглед
   - Све кључне активности и одлуке
   - Response времена за сваку фазу

3. TECHНИЧКА АНАЛИЗА
   - Root cause анализа
   - Vulnerability анализа
   - Technical detailed findings

4. IMPACT ASSESSMENT
   - Affected systems и подаци
   - Business impact
   - Financial impact
   - Репутациони утицај

5. RESPONSE EVALUATION
   - Ефикасност response процедура
   - Што је радило добро
   - Areas for improvement

6. RECOMMENDATIONS
   - Краткорочне мере
   - Дугорочне мере
   - Process improvements
   - Technology investments

7. APPENDICES
   - Technical artifacts
   - Communication records
   - Timeline charts
   - Evidence inventory
```

#### 4.4.2 Lessons Learned Session

##### Agenda за Post-Incident Review
```
□ Review инцидента timeline
□ Идентификовати што је радило
□ Идентификовати gaps и проблеме
□ Разговор о communication effectiveness
□ Analyze decision-making процес
□ Review technical response
□ Discuss prevention measures
□ Plan improvement actions
```

##### Учесници
- Сви чланови IRT тима
- Business stakeholders
- Affected customers (по потреби)
- External consultants (по потреби)
- Senior management

---

## 5. КОМУНИКАЦИОНЕ ПРОЦЕДУРЕ

### 5.1 Интерна Комуникација

#### 5.1.1 Notification Matrix

| Ниво | Време | Кога Обавестити | Метода |
|------|-------|-----------------|--------|
| **Critical** | 15 мин | CEO, CTO, DPO, Legal | Телефон + Email |
| **High** | 1 сат | IT Director, DPO | Email + SMS |
| **Medium** | 4 сата | IT Manager | Email |
| **Low** | 24 сата | Team Lead | Email |

#### 5.1.2 Редовни Updates
- **Critical инциденти**: На сваких 2 сата
- **High инциденти**: На сваких 8 сати  
- **Medium/Low**: Дневно

### 5.2 Екстерна Комуникација

#### 5.2.1 Правни Захтеви

##### Известување Надзорног Органа (ЗЗЗЛП/GDPR)
```
ВРЕМЕНСКИ РОКОВИ:
□ Data breach discovery: Тренутно log
□ Risk assessment: У року од 24 сата
□ Notification decision: У року от 48 сати
□ Regulatory notification: У року од 72 сата
□ Individual notification: У року од 96 сати (ако је high risk)
```

##### Шаблон за Regulatory Notification
```
ОБАВЕШТЕЊЕ О НАРУШАВАЊУ ЗАШТИТЕ ПОДАТАКА

1. BASIC ИНФОРМАЦИЈЕ
   - Датум и време discovery
   - Тип нарушавања
   - Affected data categories
   - Number of affected individuals

2. ОПИС ИНЦИДЕНТА
   - Како је дошло до нарушавања
   - Technical details
   - Root cause

3. ПОСЛЕДИЦЕ
   - Potential harm to individuals
   - Митигационе мере предузете
   - Current status

4. CONTACT ИНФОРМАЦИЈЕ
   - DPO contact details
   - Company information
   - Emergency contacts
```

#### 5.2.2 Комуникација са Корисницима

##### Критерији за User Notification
```
OBAVEZAN USER NOTIFICATION:
□ High risk за rights and freedoms
□ Potential identity theft
□ Financial harm possible
□ Sensitive data compromised

OPTIONAL USER NOTIFICATION:
□ Low risk scenarios
□ Technical incidents без user impact
□ Preventive measure announcements
```

##### Notification Channels
- **Primary**: Email notification
- **Secondary**: System notification
- **Emergency**: SMS за critical cases
- **Public**: Website announcement

### 5.3 Медијска Комуникација

#### 5.3.1 Media Response Plan
```
□ Designovati authorized spokesperson
□ Припремити key messages
□ Координирати са legal team
□ Monitor media coverage
□ Update stakeholders редовно
```

#### 5.3.2 Public Communication Template
```
PRESS RELEASE TEMPLATE

HEADLINE: [Company] Addresses Security Incident

Belgrade, [Date] - Републички фонд за пензијско и инвалидско осигурање today announced that it has discovered and addressed a security incident affecting its Help Desk system.

INCIDENT DETAILS:
[Што је happened - brief, factual]

IMMEDIATE ACTION:
[What we did immediately]

PROTECTION МЕРЕ:
[Security мере у місцу]

CUSTOMER IMPACT:
[Impact on customers, if any]

NEXT STEPS:
[What we're doing going forward]

CONTACT:
[Media contact информације]
```

---

## 6. SPECIFIC INCIDENT PROCEDURES

### 6.1 Data Breach Response

#### 6.1.1 Immediate Actions (First 30 minutes)
```
□ Contain the breach immediately
□ Assess scope и impact
□ Notify Incident Commander
□ Begin forensic preservation
□ Document all actions
```

#### 6.1.2 Assessment Phase (First 2 hours)
```
□ Determine what data was accessed
□ Identify affected individuals
□ Assess risk level for each category
□ Determine legal notification requirements
□ Assign risk score to incident
```

#### 6.1.3 Notification Phase (24-72 hours)
```
□ Notify надзорни орган (if required)
□ Notify affected individuals (if high risk)
□ Notify business partners (if applicable)
□ Prepare regulatory reports
□ Document notification decisions
```

### 6.2 Malware Incident Response

#### 6.2.1 Detection और Containment
```
□ Isolate infected systems immediately
□ Identify malware type и capabilities
□ Assess network propagation risk
□ Begin malware analysis
□ Prepare clean systems for recovery
```

#### 6.2.2 Analysis और Eradication
```
□ Analyze malware capabilities
□ Identify entry vector
□ Check for data exfiltration
□ Clean infected systems
□ Patch vulnerabilities
```

### 6.3 DDoS Attack Response

#### 6.3.1 Detection और Assessment
```
□ Identify attack type и source
□ Assess system impact
□ Enable DDoS mitigation measures
□ Monitor system availability
□ Coordinate with ISP (if needed)
```

#### 6.3.2 Mitigation और Recovery
```
□ Implement traffic filtering
□ Scale system resources
□ Рeroute traffic if possible
□ Monitor attack patterns
□ Plan for prolonged attack
```

---

## 7. TOOLS और RESOURCES

### 7.1 Technical Tools

#### 7.1.1 Incident Tracking
- **Platform**: PIO Help Desk internal system
- **Backup**: Emergency spreadsheet tracking
- **Fields**: ID, Type, Severity, Status, Owner, Timeline

#### 7.1.2 Communication Tools
- **Primary**: Email distribution lists
- **Emergency**: SMS alert system  
- **Collaboration**: Microsoft Teams channels
- **Public**: Website/social media

#### 7.1.3 Technical Resources
```
□ Forensic imaging tools
□ Network analysis software
□ Malware analysis sandbox
□ Log analysis tools
□ Backup validation tools
```

### 7.2 Documentation Templates

#### 7.2.1 Incident Forms
- Initial incident report
- Hourly status update
- Final incident report
- Lessons learned template
- Legal notification forms

#### 7.2.2 Communication Templates
- Internal notification email
- Customer notification email
- Regulatory notification letter
- Press release template
- FAQ documents

### 7.3 Contact Lists

#### 7.3.1 Internal Contacts
```
INCIDENT RESPONSE TEAM:
- Incident Commander: +381-64-XXX-XXXX
- Security Analyst: +381-64-XXX-XXXX
- DPO: +381-64-XXX-XXXX
- System Admin: +381-64-XXX-XXXX

MANAGEMENT:
- IT Director: +381-64-XXX-XXXX
- Deputy Director: +381-64-XXX-XXXX
- Legal Counsel: +381-64-XXX-XXXX
```

#### 7.3.2 External Contacts
```
REGULATORY:
- Повереник за информације: +381-11-3408-900
- CERT Srbija: cert@rnids.rs

LAW ENFORCEMENT:
- Киберкрим полиција: +381-11-XXX-XXXX
- Местна полиција: 192

VENDORS:
- Primary ISP: XXX-XXX-XXXX
- Security vendor: XXX-XXX-XXXX
- Legal counsel: XXX-XXX-XXXX
```

---

## 8. TRAINING और PREPAREDNESS

### 8.1 Training Requirements

#### 8.1.1 Incident Response Team
- **Initial Training**: 40-hour incident response course
- **Refresher Training**: Quarterly 4-hour sessions
- **Tabletop Exercises**: Bi-annual scenario practice
- **Certification**: Maintain incident response certifications

#### 8.1.2 General Staff
- **Security Awareness**: Annual mandatory training
- **Incident Reporting**: How और when to report
- **Basic Response**: What to do during incidents
- **Communication**: Key contacts और procedures

### 8.2 Testing और Exercises

#### 8.2.1 Tabletop Exercises
```
FREQUENCY: Bi-annual
PARTICIPANTS: Full IRT team + key stakeholders
SCENARIOS: 
□ Data breach scenarios
□ Malware outbreaks
□ DDoS attacks
□ Insider threats
□ Natural disasters
```

#### 8.2.2 Live Drills
```
FREQUENCY: Annual
SCOPE: Limited operational impact
FOCUS: Communication और coordination
METRICS: Response times और effectiveness
```

### 8.3 Plan Maintenance

#### 8.3.1 Regular Reviews
- **Quarterly**: Contact information updates
- **Semi-annual**: Procedure reviews
- **Annual**: Complete plan revision
- **As-needed**: Post-incident updates

#### 8.3.2 Improvement Integration
```
□ Incorporate lessons learned
□ Update based on new threats
□ Reflect technology changes
□ Align with regulatory updates
□ Include staff feedback
```

---

## 9. METRICS और MEASUREMENT

### 9.1 Response Metrics

#### 9.1.1 Time-based Metrics
- **Detection Time**: Time from occurrence to detection
- **Response Time**: Time from detection to first response
- **Containment Time**: Time to contain the incident
- **Resolution Time**: Time to full resolution
- **Recovery Time**: Time to resume normal operations

#### 9.1.2 Quality Metrics
- **False Positive Rate**: Percentage of false alarms
- **Escalation Rate**: Percentage requiring escalation
- **Customer Satisfaction**: Post-incident surveys
- **Compliance Rate**: Adherence to procedures
- **Communication Effectiveness**: Stakeholder feedback

### 9.2 Reporting और Dashboard

#### 9.2.1 Real-time Dashboard
```
□ Current incident status
□ Response team availability
□ System health indicators
□ Threat level indicators
□ Communication status
```

#### 9.2.2 Regular Reports
- **Daily**: Incident status updates
- **Weekly**: Trending и pattern analysis
- **Monthly**: Comprehensive incident summary
- **Quarterly**: Metrics и improvement recommendations
- **Annual**: Program effectiveness review

---

## 10. APPENDICES

### Appendix A: Quick Reference Cards
### Appendix B: Contact Information Template
### Appendix C: Legal Notification Forms
### Appendix D: Technical Checklists
### Appendix E: Communication Templates

---

## DOCUMENT INFORMATION

| Field | Value |
|--------|--------|
| **Назив** | Процедуре за Безбедносне Инциденте |
| **Верзија** | 1.0 |
| **Статус** | Draft |
| **Аутор** | IT Security Team |
| **Ревизор** | DPO, Legal Team |
| **Датум** | {{current_date}} |
| **Следећа ревизија** | {{next_review_date}} |
| **Класификација** | Поверљиво - Интерна употреба |

---

**НАПОМЕНА:** Овај документ садржи критичне безбедносне процедуре и намењен је искључиво овлашћеном особљу. Забрањено је даље дистрибуирање без одобрења.

---

*© 2024 Републички фонд за пензијско и инвалидско осигурање - Сва права задржана* 