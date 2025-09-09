import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Prisma, PrismaClient, Product } from '@prisma/client';
import { PackageDto } from 'src/product/dto/package.dto';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async getBarcodePackages() {
    const product = await this.product.findFirst();
    type PackageItem = { credits: number; price: number };

    let packages: PackageItem[];
    try {
      const raw = product.packages;

      if (typeof raw === 'string') {
        packages = JSON.parse(raw) as PackageItem[];
      } else {
        packages = raw as unknown as PackageItem[];
      }
    } catch (error) {
      this.logger.error(`Error parsing packages for product: ${product.name}`);
      return;
    }
    if (packages.length === 0) {
      this.logger.error(`Package is empty for product=${product.name}`);
    }
    return { packages: packages, product: product };
  }

  async extractPackages(product: Product) {
    type PackageItem = { credits: number; price: number };

    let packages: PackageItem[];
    try {
      const raw = product.packages;

      if (typeof raw === 'string') {
        packages = JSON.parse(raw) as PackageItem[];
      } else {
        packages = raw as unknown as PackageItem[];
      }
    } catch (error) {
      this.logger.error(`Error parsing packages for product: ${product.name}`);
      return;
    }
    if (packages.length === 0) {
      this.logger.error(`Package is empty for product=${product.name}`);
    }
    return { packages: packages, product: product };
  }

  public packagesToJSON(
    packages: PackageDto[] | undefined,
  ): Prisma.JsonArray | undefined {
    if (!packages) return undefined;
    const result = packages.map((p) => ({
      credits: p.credits,
      price: p.price,
    }));
    return result as Prisma.JsonArray;
  }
}
