import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class LagoService {
  private lago: AxiosInstance;
  constructor() {
    const LAGO_URL = process.env.LAGO_URL;
    const LAGO_API_KEY = process.env.LAGO_API_KEY;
    if (!LAGO_URL || !LAGO_API_KEY) {
      throw new Error('LAGO_URL or LAGO_API_KEY missing in .env');
    }
    this.lago = axios.create({
      baseURL: `${LAGO_URL}/api/v1`,
      headers: {
        Authorization: `Bearer ${LAGO_API_KEY}`,
      },
    });
  }
}
