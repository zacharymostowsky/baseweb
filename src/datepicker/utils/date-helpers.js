/*
Copyright (c) 2018-2020 Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
// @flow
import type {DateIOAdapter} from './types.js';
import {applyDateToTime} from './index.js';

const MINUTE = 60;
const HOUR = MINUTE * 60;

class DateHelpers<T> {
  adapter: DateIOAdapter<T>;
  constructor(adapter: DateIOAdapter<T>) {
    this.adapter = adapter;
  }
  dateToSeconds: T => number = date => {
    const seconds = this.adapter.getSeconds(date);
    const minutes = this.adapter.getMinutes(date) * MINUTE;
    const hours = this.adapter.getHours(date) * HOUR;
    return seconds + minutes + hours;
  };
  secondsToHourMinute: number => [number, number] = seconds => {
    const d = this.adapter.toJsDate(this.adapter.date(seconds * 1000));
    return [d.getUTCHours(), d.getUTCMinutes()];
  };
  differenceInCalendarMonths: (T, T) => number = (fromDate, toDate) => {
    var yearDiff =
      this.adapter.getYear(fromDate) - this.adapter.getYear(toDate);
    var monthDiff =
      this.adapter.getMonth(fromDate) - this.adapter.getMonth(toDate);
    return yearDiff * 12 + monthDiff;
  };
  differenceInCalendarDays: (T, T) => number = (fromDate, toDate) => {
    const msDiff = this.adapter.getDiff(fromDate, toDate);
    return msDiff / 864e5;
  };
  subMonths: (T, number) => T = (date, months) => {
    return this.adapter.addMonths(date, months * -1);
  };
  min: (Array<T>) => T = dates => {
    return dates.reduce((minDate, date) => {
      return this.adapter.isBefore(date, minDate) ? date : minDate;
    });
  };
  max: (Array<T>) => T = dates => {
    return dates.reduce((maxDate, date) => {
      return this.adapter.isAfter(date, maxDate) ? date : maxDate;
    });
  };
  getEffectiveMinDate: ({minDate?: T, includeDates?: Array<T>}) => T = ({
    minDate,
    includeDates,
  }) => {
    if (includeDates && minDate) {
      let minDates = includeDates.filter(
        includeDate => this.differenceInCalendarDays(includeDate, minDate) >= 0,
      );
      return this.min(minDates);
    } else if (includeDates && includeDates.length) {
      return this.min(includeDates);
    } else if (!(includeDates && includeDates.length) && minDate) {
      return minDate;
    }
    // this condition can't ever be reached
    // but flow isn't smart enough to see that all of the conditions are covered
    return this.adapter.date();
  };
  getEffectiveMaxDate: ({maxDate?: T, includeDates?: Array<T>}) => T = ({
    maxDate,
    includeDates,
  }) => {
    if (includeDates && maxDate) {
      let maxDates = includeDates.filter(
        includeDate => this.differenceInCalendarDays(includeDate, maxDate) <= 0,
      );
      // $FlowFixMe
      return this.max(maxDates);
    } else if (includeDates) {
      // $FlowFixMe
      return this.max(includeDates);
    } else if (!includeDates && maxDate) {
      return maxDate;
    }
    // this condition can't ever be reached
    // but flow isn't smart enough to see that all of the conditions are covered
    return this.adapter.date();
  };
  monthDisabledBefore: (
    T,
    {minDate: ?T, includeDates: ?Array<T>},
  ) => boolean = (day, {minDate, includeDates} = {}) => {
    const previousMonth = this.subMonths(day, 1);
    return (
      (!!minDate &&
        this.differenceInCalendarMonths(minDate, previousMonth) > 0) ||
      (!!includeDates &&
        includeDates.every(
          includeDate =>
            this.differenceInCalendarMonths(includeDate, previousMonth) > 0,
        )) ||
      false
    );
  };
  monthDisabledAfter: (T, {maxDate: ?T, includeDates: ?Array<T>}) => boolean = (
    day,
    {maxDate, includeDates} = {},
  ) => {
    const nextMonth = this.adapter.addMonths(day, 1);
    return (
      (!!maxDate && this.differenceInCalendarMonths(nextMonth, maxDate) > 0) ||
      (!!includeDates &&
        includeDates.every(
          includeDate =>
            this.differenceInCalendarMonths(nextMonth, includeDate) > 0,
        )) ||
      false
    );
  };
  setDate: (T, number) => T = (date, dayNumber) => {
    const startOfMonthNoTime = this.adapter.startOfMonth(date);
    const startOfMonthHoursAndMinutes = this.adapter.mergeDateAndTime(
      startOfMonthNoTime,
      date,
    );
    const startOfMonth = this.adapter.setSeconds(
      startOfMonthHoursAndMinutes,
      this.adapter.getSeconds(date),
    );
    return this.adapter.addDays(startOfMonth, dayNumber - 1);
  };
  applyDateToTime: (?T, T) => T = (time, date) => {
    if (!time) return date;
    const yearNumber = this.adapter.getYear(date);
    const monthNumber = this.adapter.getMonth(date);
    const dayNumber = Number(this.adapter.formatByString(date, 'd'));
    const yearDate = this.adapter.setYear(time, yearNumber);
    const monthDate = this.adapter.setMonth(yearDate, monthNumber);
    return this.setDate(monthDate, dayNumber);
  };
  isDayDisabled: (
    T,
    {
      minDate: ?T,
      maxDate: ?T,
      excludeDates: ?Array<T>,
      includeDates: ?Array<T>,
      filterDate: ?(day: T) => boolean,
    },
  ) => boolean = (
    day,
    {minDate, maxDate, excludeDates, includeDates, filterDate} = {},
  ) => {
    return (
      this.isOutOfBounds(day, {minDate, maxDate}) ||
      (excludeDates &&
        excludeDates.some(excludeDate =>
          this.adapter.isSameDay(day, excludeDate),
        )) ||
      (includeDates &&
        !includeDates.some(includeDate =>
          this.adapter.isSameDay(day, includeDate),
        )) ||
      (filterDate && !filterDate(day)) ||
      false
    );
  };
  isOutOfBounds: (T, {minDate: ?T, maxDate: ?T}) => boolean = (
    day,
    {minDate, maxDate} = {},
  ) => {
    return (
      (!!minDate && this.differenceInCalendarDays(day, minDate) < 0) ||
      (!!maxDate && this.differenceInCalendarDays(day, maxDate) > 0)
    );
  };
}

export default DateHelpers;
