import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/shared/services/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Prisma, Product } from '@prisma/client';
import { GetProductsDto } from './dto/get-products.dto';
import { ProductProducer } from 'src/kafka/producers/product.producer';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);
  constructor(
    private prisma: PrismaService,
    private producer: ProductProducer,
  ) {}

  async create(data: CreateProductDto): Promise<Product> {
    try {
      const product = await this.prisma.product.create({
        data: {
          name: data.name,
          description: data.description,
          packages: this.prisma.packagesToJSON(data.packages),
        },
      });
      this.logger.error(`Created a product ${product}`);
      return product;
    } catch (error) {
      this.logger.error(`Error creating a product ${error}`);
    }
  }

  async findAll(query: GetProductsDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput | undefined = query?.name
      ? {
          name: {
            contains: query.name,
            mode: 'insensitive',
          },
        }
      : undefined;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findOne(id: string): Promise<Product | null> {
    return await this.prisma.product.findUnique({ where: { id } });
  }

  async update(id: string, data: UpdateProductDto): Promise<Product> {
    try {
      const { packages, ...rest } = data;

      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...rest,
          ...(packages !== undefined && {
            packages: this.prisma.packagesToJSON(data.packages),
          }),
        },
      });
      await this.producer.productUpdated(product);
      return product;
    } catch (error) {
      this.logger.error(`Error updating a product ${error}`);
    }
  }

  async remove(id: string): Promise<Product> {
    return await this.prisma.product.delete({ where: { id } });
  }
}
