/**
 * Product Controller
 * GAP-02: Product/SKU CRUD Implementation
 * 
 * RESTful API endpoints for product management
 */

import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProductService, CreateProductDto, UpdateProductDto } from './product.service';

interface AuthUser {
    userId: string;
    organizationId: string;
    role: string;
}

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductController {
    constructor(private readonly productService: ProductService) { }

    /**
     * Create a new product
     */
    @Post()
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Create a new product' })
    async createProduct(
        @CurrentUser() user: AuthUser,
        @Body() dto: CreateProductDto,
    ) {
        return this.productService.createProduct(user.organizationId, dto);
    }

    /**
     * Get all products
     */
    @Get()
    @ApiOperation({ summary: 'Get all products' })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'category', required: false })
    @ApiQuery({ name: 'warehouseId', required: false })
    @ApiQuery({ name: 'stockLevel', required: false, enum: ['low', 'out', 'normal', 'all'] })
    @ApiQuery({ name: 'isActive', required: false, type: Boolean })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'pageSize', required: false, type: Number })
    async getProducts(
        @CurrentUser() user: AuthUser,
        @Query('search') search?: string,
        @Query('category') category?: string,
        @Query('warehouseId') warehouseId?: string,
        @Query('stockLevel') stockLevel?: 'low' | 'out' | 'normal' | 'all',
        @Query('isActive') isActive?: string,
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
    ) {
        return this.productService.getProducts(user.organizationId, {
            search,
            category,
            warehouseId,
            stockLevel,
            isActive: isActive !== undefined ? isActive === 'true' : undefined,
            page: page ? parseInt(page, 10) : undefined,
            pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
        });
    }

    /**
     * Get product categories
     */
    @Get('categories')
    @ApiOperation({ summary: 'Get unique product categories' })
    async getCategories(@CurrentUser() user: AuthUser) {
        return this.productService.getCategories(user.organizationId);
    }

    /**
     * Get product by ID
     */
    @Get(':id')
    @ApiOperation({ summary: 'Get product by ID' })
    async getProductById(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
    ) {
        return this.productService.getProductById(user.organizationId, id);
    }

    /**
     * Get product stock
     */
    @Get(':id/stock')
    @ApiOperation({ summary: 'Get product stock totals' })
    async getProductStock(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
    ) {
        return this.productService.getProductStock(user.organizationId, id);
    }

    /**
     * Get product history
     */
    @Get(':id/history')
    @ApiOperation({ summary: 'Get product stock history' })
    async getProductHistory(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
    ) {
        return this.productService.getProductHistory(user.organizationId, id);
    }

    /**
     * Update product
     */
    @Patch(':id')
    @Roles('ADMIN', 'MANAGER')
    @ApiOperation({ summary: 'Update product' })
    async updateProduct(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
        @Body() dto: UpdateProductDto,
    ) {
        return this.productService.updateProduct(user.organizationId, id, dto);
    }

    /**
     * Delete product
     */
    @Delete(':id')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete product' })
    async deleteProduct(
        @CurrentUser() user: AuthUser,
        @Param('id') id: string,
    ) {
        await this.productService.deleteProduct(user.organizationId, id);
    }
}
