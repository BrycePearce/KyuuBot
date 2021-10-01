import { performance } from 'perf_hooks';

export function Measure(name?: string) {
  return function (target: Object, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any) {
      const start = performance.now();
      const result = originalMethod.apply(this, args);
      const finish = performance.now();
      console.log(`[${name ? name : propertyKey}] took ${(finish - start).toFixed(2)} ms`);
      return result;
    };

    return descriptor;
  };
}
