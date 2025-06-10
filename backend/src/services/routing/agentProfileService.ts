/**
 * Agent Profile Service
 * Manages agent profiles, skills, availability, and performance metrics
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentProfile,
  AgentSkill,
  AgentSkillLevel,
  AgentAvailability,
  PerformanceMetrics,
  WorkingSchedule
} from '../../models/agentProfile';
import { logger } from '../../utils/logger';

export class AgentProfileService {
  private dataDir: string;
  private profilesPath: string;
  private skillsPath: string;
  private skillLevelsPath: string;
  private availabilityPath: string;
  private performancePath: string;

  constructor() {
    this.dataDir = path.join(__dirname, '../../../..', 'data/routing');
    this.profilesPath = path.join(this.dataDir, 'agent-profiles.json');
    this.skillsPath = path.join(this.dataDir, 'skills.json');
    this.skillLevelsPath = path.join(this.dataDir, 'skill-levels.json');
    this.availabilityPath = path.join(this.dataDir, 'availability.json');
    this.performancePath = path.join(this.dataDir, 'performance.json');
    this.ensureDirectoriesExist();
  }

  /**
   * Ensure routing data directories exist
   */
  private async ensureDirectoriesExist(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (error) {
      logger.error('Error creating routing directories:', error);
    }
  }

  /**
   * Load data from JSON file with error handling
   */
  private async loadData<T>(filePath: string, defaultValue: T[] = []): Promise<T[]> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Save data to JSON file
   */
  private async saveData<T>(filePath: string, data: T[]): Promise<void> {
    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonData, 'utf-8');
  }

  /**
   * Initialize default skills for PIO Help Desk
   */
  async initializeDefaultSkills(): Promise<void> {
    try {
      const existingSkills = await this.loadData<AgentSkill>(this.skillsPath);
      
      if (existingSkills.length > 0) {
        logger.info('Skills already initialized');
        return;
      }

      const defaultSkills: AgentSkill[] = [
        // Hardware skills
        {
          id: 'skill-hw-desktop',
          name: 'desktop_support',
          displayName: 'Подршка за десктоп рачунаре',
          category: 'hardware',
          description: 'Решавање проблема са десктоп рачунарима, инсталација и одржавање'
        },
        {
          id: 'skill-hw-laptop',
          name: 'laptop_support',
          displayName: 'Подршка за лаптопове',
          category: 'hardware',
          description: 'Решавање проблема са лаптоповима и мобилним уређајима'
        },
        {
          id: 'skill-hw-printer',
          name: 'printer_support',
          displayName: 'Подршка за штампаче',
          category: 'hardware',
          description: 'Инсталација, конфигурација и решавање проблема са штампачима'
        },
        {
          id: 'skill-hw-monitor',
          name: 'monitor_support',
          displayName: 'Подршка за мониторе',
          category: 'hardware',
          description: 'Решавање проблема са мониторима и графичким приказом'
        },

        // Software skills
        {
          id: 'skill-sw-windows',
          name: 'windows_support',
          displayName: 'Windows оперативни систем',
          category: 'software',
          description: 'Подршка за Windows OS, инсталација и конфигурација'
        },
        {
          id: 'skill-sw-office',
          name: 'office_support',
          displayName: 'Microsoft Office',
          category: 'software',
          description: 'Подршка за MS Office пакет и канцеларијске апликације'
        },
        {
          id: 'skill-sw-pio',
          name: 'pio_applications',
          displayName: 'ПИО апликације',
          category: 'software',
          description: 'Специјализоване апликације Пензијског и инвалидског осигурања'
        },
        {
          id: 'skill-sw-antivirus',
          name: 'antivirus_support',
          displayName: 'Антивирусни софтвер',
          category: 'software',
          description: 'Инсталација и подршка за антивирусне програме'
        },

        // Network skills  
        {
          id: 'skill-net-connectivity',
          name: 'network_connectivity',
          displayName: 'Мрежне везе',
          category: 'network',
          description: 'Решавање проблема са интернет везама и локалном мрежом'
        },
        {
          id: 'skill-net-wifi',
          name: 'wifi_support',
          displayName: 'WiFi подршка',
          category: 'network',
          description: 'Конфигурација и решавање проблема са бежичним мрежама'
        },
        {
          id: 'skill-net-vpn',
          name: 'vpn_support',
          displayName: 'VPN подршка',
          category: 'network',
          description: 'Подешавање и одржавање VPN веза'
        },

        // Security skills
        {
          id: 'skill-sec-passwords',
          name: 'password_management',
          displayName: 'Управљање лозинкама',
          category: 'security',
          description: 'Ресетовање лозинки и управљање приступом'
        },
        {
          id: 'skill-sec-accounts',
          name: 'account_management',
          displayName: 'Управљање корисничким налозима',
          category: 'security',
          description: 'Креирање, модификација и деактивирање корисничких налога'
        },
        {
          id: 'skill-sec-permissions',
          name: 'permissions_management',
          displayName: 'Управљање дозволама',
          category: 'security',
          description: 'Подешавање приступних права и дозвола'
        },

        // Email skills
        {
          id: 'skill-email-outlook',
          name: 'outlook_support',
          displayName: 'Outlook подршка',
          category: 'email',
          description: 'Конфигурација и решавање проблема са Outlook-ом'
        },
        {
          id: 'skill-email-server',
          name: 'email_server',
          displayName: 'Email сервер',
          category: 'email',
          description: 'Администрација и одржавање email сервера'
        },

        // Training skills
        {
          id: 'skill-train-users',
          name: 'user_training',
          displayName: 'Обука корисника',
          category: 'training',
          description: 'Едукација корисника и израда упутстава'
        },
        {
          id: 'skill-train-documentation',
          name: 'documentation',
          displayName: 'Документација',
          category: 'training',
          description: 'Креирање техничке документације и приручника'
        }
      ];

      await this.saveData(this.skillsPath, defaultSkills);
      logger.info(`Initialized ${defaultSkills.length} default skills`);
    } catch (error) {
      logger.error('Error initializing default skills:', error);
      throw new Error('Failed to initialize default skills');
    }
  }

  /**
   * Create sample agent profiles for testing
   */
  async initializeSampleAgents(): Promise<void> {
    try {
      const existingProfiles = await this.loadData<AgentProfile>(this.profilesPath);
      
      if (existingProfiles.length > 0) {
        logger.info('Agent profiles already initialized');
        return;
      }

      const currentDate = new Date().toISOString();
      const sampleProfiles: AgentProfile[] = [
        {
          id: 'agent-001',
          userId: 'user-tech-001',
          displayName: 'Марко Петровић',
          department: 'IT Подршка',
          jobTitle: 'Виши техничар',
          email: 'marko.petrovic@pio.rs',
          phoneNumber: '+381-11-xxx-xxxx',
          isActive: true,
          startDate: '2020-01-15',
          experienceLevel: 'senior',
          yearsOfExperience: 8,
          primaryLanguages: ['sr', 'en'],
          preferredCategories: ['hardware', 'software'],
          preferredWorkload: 'medium',
          canHandleUrgentTickets: true,
          canMentorJuniors: true,
          preferredContactMethod: 'email',
          workingHoursContactOnly: false,
          createdAt: currentDate,
          updatedAt: currentDate,
          createdBy: 'system',
          lastModifiedBy: 'system'
        },
        {
          id: 'agent-002',
          userId: 'user-tech-002',
          displayName: 'Ана Јовановић',
          department: 'IT Подршка',
          jobTitle: 'Мрежни администратор',
          email: 'ana.jovanovic@pio.rs',
          phoneNumber: '+381-11-xxx-xxxy',
          isActive: true,
          startDate: '2018-03-10',
          experienceLevel: 'expert',
          yearsOfExperience: 12,
          primaryLanguages: ['sr'],
          preferredCategories: ['network', 'security'],
          preferredWorkload: 'heavy',
          canHandleUrgentTickets: true,
          canMentorJuniors: true,
          preferredContactMethod: 'teams',
          workingHoursContactOnly: true,
          createdAt: currentDate,
          updatedAt: currentDate,
          createdBy: 'system',
          lastModifiedBy: 'system'
        },
        {
          id: 'agent-003',
          userId: 'user-tech-003',
          displayName: 'Милош Николић',
          department: 'IT Подршка',
          jobTitle: 'Млађи техничар',
          email: 'milos.nikolic@pio.rs',
          isActive: true,
          startDate: '2023-09-01',
          experienceLevel: 'junior',
          yearsOfExperience: 1,
          primaryLanguages: ['sr'],
          preferredCategories: ['email', 'training'],
          preferredWorkload: 'light',
          canHandleUrgentTickets: false,
          canMentorJuniors: false,
          preferredContactMethod: 'slack',
          workingHoursContactOnly: true,
          createdAt: currentDate,
          updatedAt: currentDate,
          createdBy: 'system',
          lastModifiedBy: 'system'
        },
        {
          id: 'agent-004',
          userId: 'user-tech-004',
          displayName: 'Тамара Стојановић',
          department: 'IT Подршка',
          jobTitle: 'Системски администратор',
          email: 'tamara.stojanovic@pio.rs',
          isActive: true,
          startDate: '2019-06-15',
          experienceLevel: 'senior',
          yearsOfExperience: 10,
          primaryLanguages: ['sr', 'en'],
          preferredCategories: ['software', 'security'],
          preferredWorkload: 'medium',
          canHandleUrgentTickets: true,
          canMentorJuniors: true,
          preferredContactMethod: 'email',
          workingHoursContactOnly: false,
          createdAt: currentDate,
          updatedAt: currentDate,
          createdBy: 'system',
          lastModifiedBy: 'system'
        }
      ];

      await this.saveData(this.profilesPath, sampleProfiles);
      logger.info(`Initialized ${sampleProfiles.length} sample agent profiles`);
    } catch (error) {
      logger.error('Error initializing sample agents:', error);
      throw new Error('Failed to initialize sample agents');
    }
  }

  /**
   * Initialize agent skill levels for sample agents
   */
  async initializeSampleSkillLevels(): Promise<void> {
    try {
      const existingSkillLevels = await this.loadData<AgentSkillLevel>(this.skillLevelsPath);
      
      if (existingSkillLevels.length > 0) {
        logger.info('Skill levels already initialized');
        return;
      }

      const currentDate = new Date().toISOString();
      const skillLevels: AgentSkillLevel[] = [
        // Marko Petrović skills (Senior - Hardware/Software focus)
        { skillId: 'skill-hw-desktop', agentId: 'agent-001', level: 4, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-hw-laptop', agentId: 'agent-001', level: 4, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-hw-printer', agentId: 'agent-001', level: 3, lastUpdated: currentDate, certificationSource: 'Обука' },
        { skillId: 'skill-sw-windows', agentId: 'agent-001', level: 5, lastUpdated: currentDate, certificationSource: 'Сертификат' },
        { skillId: 'skill-sw-office', agentId: 'agent-001', level: 4, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-sw-pio', agentId: 'agent-001', level: 3, lastUpdated: currentDate, certificationSource: 'Обука' },

        // Ana Jovanović skills (Expert - Network/Security focus)
        { skillId: 'skill-net-connectivity', agentId: 'agent-002', level: 5, lastUpdated: currentDate, certificationSource: 'Сертификат' },
        { skillId: 'skill-net-wifi', agentId: 'agent-002', level: 5, lastUpdated: currentDate, certificationSource: 'Сертификат' },
        { skillId: 'skill-net-vpn', agentId: 'agent-002', level: 4, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-sec-passwords', agentId: 'agent-002', level: 5, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-sec-accounts', agentId: 'agent-002', level: 5, lastUpdated: currentDate, certificationSource: 'Сертификат' },
        { skillId: 'skill-sec-permissions', agentId: 'agent-002', level: 4, lastUpdated: currentDate, certificationSource: 'Искуство' },

        // Miloš Nikolić skills (Junior - Email/Training focus)
        { skillId: 'skill-email-outlook', agentId: 'agent-003', level: 2, lastUpdated: currentDate, certificationSource: 'Обука' },
        { skillId: 'skill-train-users', agentId: 'agent-003', level: 3, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-train-documentation', agentId: 'agent-003', level: 2, lastUpdated: currentDate, certificationSource: 'Обука' },
        { skillId: 'skill-sw-office', agentId: 'agent-003', level: 3, lastUpdated: currentDate, certificationSource: 'Обука' },
        { skillId: 'skill-sec-passwords', agentId: 'agent-003', level: 2, lastUpdated: currentDate, certificationSource: 'Обука' },

        // Tamara Stojanović skills (Senior - Software/Security focus)
        { skillId: 'skill-sw-windows', agentId: 'agent-004', level: 5, lastUpdated: currentDate, certificationSource: 'Сертификат' },
        { skillId: 'skill-sw-pio', agentId: 'agent-004', level: 5, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-sw-antivirus', agentId: 'agent-004', level: 4, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-sec-accounts', agentId: 'agent-004', level: 4, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-sec-permissions', agentId: 'agent-004', level: 4, lastUpdated: currentDate, certificationSource: 'Искуство' },
        { skillId: 'skill-email-server', agentId: 'agent-004', level: 3, lastUpdated: currentDate, certificationSource: 'Обука' }
      ];

      await this.saveData(this.skillLevelsPath, skillLevels);
      logger.info(`Initialized ${skillLevels.length} skill level assignments`);
    } catch (error) {
      logger.error('Error initializing skill levels:', error);
      throw new Error('Failed to initialize skill levels');
    }
  }

  /**
   * Initialize agent availability data
   */
  async initializeSampleAvailability(): Promise<void> {
    try {
      const existingAvailability = await this.loadData<AgentAvailability>(this.availabilityPath);
      
      if (existingAvailability.length > 0) {
        logger.info('Availability data already initialized');
        return;
      }

      const currentDate = new Date().toISOString();
      
      // Standard working schedule (Monday-Friday, 8:00-16:00)
      const standardSchedule: WorkingSchedule[] = [
        { dayOfWeek: 1, startTime: '08:00', endTime: '16:00', isActive: true, timezone: 'Europe/Belgrade' },
        { dayOfWeek: 2, startTime: '08:00', endTime: '16:00', isActive: true, timezone: 'Europe/Belgrade' },
        { dayOfWeek: 3, startTime: '08:00', endTime: '16:00', isActive: true, timezone: 'Europe/Belgrade' },
        { dayOfWeek: 4, startTime: '08:00', endTime: '16:00', isActive: true, timezone: 'Europe/Belgrade' },
        { dayOfWeek: 5, startTime: '08:00', endTime: '16:00', isActive: true, timezone: 'Europe/Belgrade' },
        { dayOfWeek: 0, startTime: '08:00', endTime: '16:00', isActive: false, timezone: 'Europe/Belgrade' },
        { dayOfWeek: 6, startTime: '08:00', endTime: '16:00', isActive: false, timezone: 'Europe/Belgrade' }
      ];

      const availability: AgentAvailability[] = [
        {
          agentId: 'agent-001',
          currentStatus: 'available',
          lastStatusUpdate: currentDate,
          workingSchedule: standardSchedule,
          maxConcurrentTickets: 8,
          currentTicketCount: 3,
          isOnVacation: false,
          notes: 'Доступан за све врсте тикета'
        },
        {
          agentId: 'agent-002',
          currentStatus: 'available',
          lastStatusUpdate: currentDate,
          workingSchedule: standardSchedule,
          maxConcurrentTickets: 10,
          currentTicketCount: 5,
          isOnVacation: false,
          notes: 'Специјалиста за мрежне проблеме'
        },
        {
          agentId: 'agent-003',
          currentStatus: 'available',
          lastStatusUpdate: currentDate,
          workingSchedule: standardSchedule,
          maxConcurrentTickets: 5,
          currentTicketCount: 2,
          isOnVacation: false,
          notes: 'Нови запослени, потребан ментор за сложене проблеме'
        },
        {
          agentId: 'agent-004',
          currentStatus: 'busy',
          lastStatusUpdate: currentDate,
          workingSchedule: standardSchedule,
          maxConcurrentTickets: 7,
          currentTicketCount: 6,
          isOnVacation: false,
          notes: 'Тренутно на важном пројекту, ограничена доступност'
        }
      ];

      await this.saveData(this.availabilityPath, availability);
      logger.info(`Initialized availability for ${availability.length} agents`);
    } catch (error) {
      logger.error('Error initializing availability:', error);
      throw new Error('Failed to initialize availability');
    }
  }

  /**
   * Get all agent profiles
   */
  async getAllAgentProfiles(): Promise<AgentProfile[]> {
    return this.loadData<AgentProfile>(this.profilesPath);
  }

  /**
   * Get agent profile by ID
   */
  async getAgentProfile(agentId: string): Promise<AgentProfile | null> {
    const profiles = await this.getAllAgentProfiles();
    return profiles.find(p => p.id === agentId) || null;
  }

  /**
   * Get all skills
   */
  async getAllSkills(): Promise<AgentSkill[]> {
    return this.loadData<AgentSkill>(this.skillsPath);
  }

  /**
   * Get skill levels for an agent
   */
  async getAgentSkillLevels(agentId: string): Promise<AgentSkillLevel[]> {
    const skillLevels = await this.loadData<AgentSkillLevel>(this.skillLevelsPath);
    return skillLevels.filter(sl => sl.agentId === agentId);
  }

  /**
   * Get agent availability
   */
  async getAgentAvailability(agentId: string): Promise<AgentAvailability | null> {
    const availability = await this.loadData<AgentAvailability>(this.availabilityPath);
    return availability.find(a => a.agentId === agentId) || null;
  }

  /**
   * Get available agents (status = available and not on vacation)
   */
  async getAvailableAgents(): Promise<string[]> {
    const availability = await this.loadData<AgentAvailability>(this.availabilityPath);
    return availability
      .filter(a => a.currentStatus === 'available' && !a.isOnVacation)
      .map(a => a.agentId);
  }

  /**
   * Update agent availability status
   */
  async updateAgentStatus(agentId: string, status: 'available' | 'busy' | 'away' | 'offline'): Promise<void> {
    const availability = await this.loadData<AgentAvailability>(this.availabilityPath);
    const agentAvailability = availability.find(a => a.agentId === agentId);
    
    if (agentAvailability) {
      agentAvailability.currentStatus = status;
      agentAvailability.lastStatusUpdate = new Date().toISOString();
      await this.saveData(this.availabilityPath, availability);
      logger.info(`Updated agent ${agentId} status to ${status}`);
    }
  }

  /**
   * Initialize all sample data
   */
  async initializeAllSampleData(): Promise<void> {
    try {
      await this.initializeDefaultSkills();
      await this.initializeSampleAgents();
      await this.initializeSampleSkillLevels();
      await this.initializeSampleAvailability();
      logger.info('Successfully initialized all sample routing data');
    } catch (error) {
      logger.error('Error initializing sample data:', error);
      throw new Error('Failed to initialize sample data');
    }
  }
}

export default new AgentProfileService(); 