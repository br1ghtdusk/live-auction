import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';
import { message } from 'antd';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://118.196.28.152:8081/api';

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message?: string;
}

const request: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
  (error: AxiosError) => {
    console.error('[Request] 请求配置错误:', error);
    return Promise.reject(error);
  }
);

request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { code, message: msg } = response.data;

    if (code !== 200 && code !== 0) {
      message.error(msg || '请求失败，请稍后重试');
      return Promise.reject(new Error(msg || '请求失败'));
    }

    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    const status = error.response?.status;
    const serverMsg = error.response?.data?.message;

    switch (status) {
      case 500:
        message.error(serverMsg || '服务器内部错误，请联系管理员');
        break;
      case 502:
      case 503:
        message.error('服务暂时不可用，请稍后重试');
        break;
      case 0:
        message.error('网络连接失败，请检查网络');
        break;
      default:
        if (status) {
          message.error(serverMsg || `请求失败 (${status})`);
        } else {
          message.error('网络异常，请检查网络连接');
        }
    }

    return Promise.reject(error);
  }
);

export default request;