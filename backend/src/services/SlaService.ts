import { PrismaClient } from '@prisma/client';
import { addHours, isAfter, isBefore, format, parseISO, startOfDay, endOfDay, addDays, differenceInHours, differenceInMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

const prisma = new PrismaClient();
const BELGRADE_TIMEZONE = 'Europe/Belgrade';

export interface SlaCalculationResult {
  responseTimeHours: number;
  resolutionTimeHours: number;
  responseDueDate: Date;
  resolutionDueDate: Date;
  slaStatus: 'on_track' | 'warning' | 'breached';
}

export interface SlaMetrics {
  businessHoursWorked: number;
  totalCalendarHours: number;
  holidaysEncountered: string[];
  isWithinSla: boolean;
}

export class SlaService {
  /**
   * Израчунава SLA метрике за тикет на основу категорије и приоритета
   */
  async calculateSlaForTicket(
    ticketId: string,
    categoryId: string | null,
    priority: string,
    createdAt: Date,
    currentTime?: Date
  ): Promise<SlaCalculationResult> {
    const now = currentTime || new Date();
    
    // Добијање SLA политике
    const slaPolicy = await this.getSlaPolicy(categoryId, priority);
    
    // Конвертовање времена у београдску временску зону
    const createdAtBelgrade = toZonedTime(createdAt, BELGRADE_TIMEZONE);
    const nowBelgrade = toZonedTime(now, BELGRADE_TIMEZONE);
    
    // Рачунање датума досписћа
    const responseDue = await this.calculateDueDate(
      createdAtBelgrade, 
      slaPolicy.responseTimeHours, 
      slaPolicy.businessHoursOnly
    );
    
    const resolutionDue = await this.calculateDueDate(
      createdAtBelgrade, 
      slaPolicy.resolutionTimeHours, 
      slaPolicy.businessHoursOnly
    );
    
    // Провера тренутног статуса
    const slaStatus = this.determineSlaStatus(nowBelgrade, responseDue, resolutionDue);
    
    return {
      responseTimeHours: slaPolicy.responseTimeHours,
      resolutionTimeHours: slaPolicy.resolutionTimeHours,
      responseDueDate: fromZonedTime(responseDue, BELGRADE_TIMEZONE),
      resolutionDueDate: fromZonedTime(resolutionDue, BELGRADE_TIMEZONE),
      slaStatus
    };
  }

  /**
   * Рачуна датум досписћа узимајући у обзир радне сате и празнике
   */
  private async calculateDueDate(
    startDate: Date,
    hoursToAdd: number,
    businessHoursOnly: boolean
  ): Promise<Date> {
    if (!businessHoursOnly) {
      // 24/7 режим - једноставно додавање сати
      return addHours(startDate, hoursToAdd);
    }

    // Учитавање радних сати и празника
    const businessHours = await this.getBusinessHours();
    const holidays = await this.getHolidays();
    
    let currentDate = new Date(startDate);
    let remainingHours = hoursToAdd;
    
    while (remainingHours > 0) {
      const dayOfWeek = currentDate.getDay();
      const isHoliday = this.isHoliday(currentDate, holidays);
      const workingDay = businessHours.find(bh => bh.dayOfWeek === dayOfWeek);
      
      if (workingDay && workingDay.isWorkingDay && !isHoliday) {
        // Радни дан - рачунај сате у оквиру радног времена
        const dayStart = this.parseTimeInDate(currentDate, workingDay.startTime);
        const dayEnd = this.parseTimeInDate(currentDate, workingDay.endTime);
        
        let workStart = currentDate.getTime() === startDate.getTime() 
          ? this.getWorkStartTime(currentDate, dayStart, dayEnd)
          : dayStart;
        
        const availableHours = Math.max(0, differenceInHours(dayEnd, workStart));
        
        if (availableHours > 0) {
          if (remainingHours <= availableHours) {
            // Можемо завршити данас
            return addHours(workStart, remainingHours);
          } else {
            // Смањујемо преостале сате за данас и прелазимо на следећи дан
            remainingHours -= availableHours;
          }
        }
      }
      
      // Прелазимо на следећи дан
      currentDate = addDays(startOfDay(currentDate), 1);
    }
    
    return currentDate;
  }

  /**
   * Добија почетно време рада за дати дан
   */
  private getWorkStartTime(currentTime: Date, dayStart: Date, dayEnd: Date): Date {
    if (isBefore(currentTime, dayStart)) {
      return dayStart;
    } else if (isAfter(currentTime, dayEnd)) {
      return dayEnd; // Након радног времена, неће се користити
    } else {
      return currentTime; // Тренутно време је у оквиру радног времена
    }
  }

  /**
   * Парсира време у формату HH:MM у дати датум
   */
  private parseTimeInDate(date: Date, timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /**
   * Проверава да ли је дати датум празник
   */
  private isHoliday(date: Date, holidays: any[]): boolean {
    const dateString = format(startOfDay(date), 'yyyy-MM-dd');
    return holidays.some(holiday => {
      const holidayDate = format(startOfDay(holiday.date), 'yyyy-MM-dd');
      return holidayDate === dateString && holiday.isActive;
    });
  }

  /**
   * Одређује тренутни SLA статус
   */
  private determineSlaStatus(
    currentTime: Date, 
    responseDue: Date, 
    resolutionDue: Date
  ): 'on_track' | 'warning' | 'breached' {
    const responseTimeLeft = differenceInMinutes(responseDue, currentTime) || 0;
    const resolutionTimeLeft = differenceInMinutes(resolutionDue, currentTime) || 0;
    
    // Прекршај ако је прошао било који рок
    if (responseTimeLeft < 0 || resolutionTimeLeft < 0) {
      return 'breached';
    }
    
    // Упозорење ако је остало мање од 25% времена
    const warningThreshold = 0.25;
    const responseOriginalHours = this.calculateOriginalHours(responseDue, currentTime);
    const resolutionOriginalHours = this.calculateOriginalHours(resolutionDue, currentTime);
    
    if (responseTimeLeft < (60 * responseOriginalHours * warningThreshold) ||
        resolutionTimeLeft < (60 * resolutionOriginalHours * warningThreshold)) {
      return 'warning';
    }
    
    return 'on_track';
  }

  /**
   * Помоћна функција за рачунање оригиналних сати
   */
  private calculateOriginalHours(dueDate: Date, currentDate: Date): number {
    const hours = differenceInHours(dueDate, currentDate);
    return Math.max(1, hours || 0);
  }

  /**
   * Добија SLA политику за категорију и приоритет
   */
  private async getSlaPolicy(categoryId: string | null, priority: string) {
    // Покушај са специфичном политиком за категорију и приоритет
    let policy = await prisma.slaPolicy.findFirst({
      where: {
        categoryId: categoryId,
        priority: priority,
        isActive: true
      }
    });

    // Покушај са политиком за приоритет
    if (!policy) {
      policy = await prisma.slaPolicy.findFirst({
        where: {
          priority: priority,
          categoryId: null,
          isActive: true
        }
      });
    }

    // Покушај са политиком за категорију
    if (!policy && categoryId) {
      policy = await prisma.slaPolicy.findFirst({
        where: {
          categoryId: categoryId,
          priority: null,
          isActive: true
        }
      });
    }

    // Користи подразумевану политику
    if (!policy) {
      policy = await prisma.slaPolicy.findFirst({
        where: {
          name: 'Подразумевана SLA политика',
          isActive: true
        }
      });
    }

    if (!policy) {
      throw new Error('Није пронађена ниједна активна SLA политика');
    }

    return policy;
  }

  /**
   * Добија радне сате из базе
   */
  private async getBusinessHours() {
    return await prisma.businessHours.findMany({
      orderBy: { dayOfWeek: 'asc' }
    });
  }

  /**
   * Добија празнике из базе
   */
  private async getHolidays() {
    const currentYear = new Date().getFullYear();
    return await prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(`${currentYear}-01-01`),
          lte: new Date(`${currentYear}-12-31`)
        },
        isActive: true
      }
    });
  }

  /**
   * Рачуна детаљне SLA метрике за анализу
   */
  async calculateSlaMetrics(
    startDate: Date,
    endDate: Date,
    businessHoursOnly: boolean = true
  ): Promise<SlaMetrics> {
    const startBelgrade = toZonedTime(startDate, BELGRADE_TIMEZONE);
    const endBelgrade = toZonedTime(endDate, BELGRADE_TIMEZONE);
    
    const totalCalendarHours = differenceInHours(endBelgrade, startBelgrade);
    
    if (!businessHoursOnly) {
      return {
        businessHoursWorked: totalCalendarHours,
        totalCalendarHours,
        holidaysEncountered: [],
        isWithinSla: true
      };
    }

    const businessHours = await this.getBusinessHours();
    const holidays = await this.getHolidays();
    
    let businessHoursWorked = 0;
    let holidaysEncountered: string[] = [];
    let currentDate = new Date(startBelgrade);
    
    while (isBefore(currentDate, endBelgrade)) {
      const dayOfWeek = currentDate.getDay();
      const isHoliday = this.isHoliday(currentDate, holidays);
      const workingDay = businessHours.find(bh => bh.dayOfWeek === dayOfWeek);
      
      if (isHoliday) {
        const holiday = holidays.find(h => this.isHoliday(currentDate, [h]));
        if (holiday) {
          holidaysEncountered.push(holiday.name);
        }
      }
      
      if (workingDay && workingDay.isWorkingDay && !isHoliday) {
        const dayStart = this.parseTimeInDate(currentDate, workingDay.startTime);
        const dayEnd = this.parseTimeInDate(currentDate, workingDay.endTime);
        
        const workStart = isAfter(currentDate, dayStart) ? currentDate : dayStart;
        const workEnd = isBefore(endBelgrade, dayEnd) ? endBelgrade : dayEnd;
        
        if (isBefore(workStart, workEnd)) {
          businessHoursWorked += differenceInHours(workEnd, workStart);
        }
      }
      
      currentDate = addDays(startOfDay(currentDate), 1);
    }
    
    return {
      businessHoursWorked,
      totalCalendarHours,
      holidaysEncountered: [...new Set(holidaysEncountered)], // Уклони дупликате
      isWithinSla: true // Ово ће бити одређено на основу SLA политике
    };
  }

  /**
   * Креира SLA догађај за тикет
   */
  async createSlaEvent(
    ticketId: string,
    slaPolicyId: string,
    eventType: string,
    dueDate: Date,
    message?: string
  ) {
    return await prisma.slaEvent.create({
      data: {
        ticketId,
        slaPolicyId,
        eventType,
        status: 'pending',
        dueDate: fromZonedTime(dueDate, BELGRADE_TIMEZONE),
        message: message || `SLA ${eventType} за тикет ${ticketId}`,
        metadata: JSON.stringify({
          timezone: BELGRADE_TIMEZONE,
          createdAt: new Date().toISOString()
        })
      }
    });
  }

  /**
   * Ажурира SLA метрике за тикет
   */
  async updateTicketSlaMetrics(ticketId: string) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { category: true }
    });

    if (!ticket) {
      throw new Error(`Тикет ${ticketId} није пронађен`);
    }

    const slaResult = await this.calculateSlaForTicket(
      ticket.id,
      ticket.categoryId,
      ticket.priority,
      ticket.createdAt
    );

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        slaResponseDue: slaResult.responseDueDate,
        slaResolutionDue: slaResult.resolutionDueDate,
        slaStatus: slaResult.slaStatus
      }
    });

    return slaResult;
  }
}

export default new SlaService(); 