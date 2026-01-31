import { PrismaClient, UserRole, ChannelType, ShipmentStatus } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

/**
 * Multi-Tenant Test Setup Helper
 * 
 * Provides utilities for creating isolated test organizations
 * to verify cross-tenant data isolation.
 */

export interface TestOrganization {
    organization: {
        id: string;
        name: string;
    };
    user: {
        id: string;
        email: string;
        role: UserRole;
    };
    token: string;
    data: {
        orderId?: string;
        channelId?: string;
        inventoryId?: string;
        shipmentId?: string;
        warehouseId?: string;
        productId?: string;
        skuId?: string;
        customerId?: string;
    };
}

/**
 * Create a test organization with an admin user
 */
export async function createTestOrganization(
    prisma: PrismaClient,
    jwtService: JwtService,
    name: string,
): Promise<TestOrganization> {
    const orgId = uuidv4();
    const userId = uuidv4();
    const email = `test-${Date.now()}-${Math.random().toString(36).substring(7)}@${name.toLowerCase().replace(/\s/g, '')}.test`;

    // Create organization
    const organization = await prisma.organization.create({
        data: {
            id: orgId,
            name,
            isActive: true,
        },
    });

    // Create user
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const user = await prisma.user.create({
        data: {
            id: userId,
            email,
            password: passwordHash,
            firstName: 'Test',
            lastName: 'Admin',
            isActive: true,
        },
    });

    // Create user-organization membership
    await prisma.userOrganization.create({
        data: {
            userId: user.id,
            organizationId: organization.id,
            role: UserRole.ADMIN,
        },
    });

    // Generate JWT token
    const token = jwtService.sign({
        sub: user.id,
        orgId: organization.id,
        role: UserRole.ADMIN,
    });

    return {
        organization: {
            id: organization.id,
            name: organization.name,
        },
        user: {
            id: user.id,
            email: user.email,
            role: UserRole.ADMIN,
        },
        token,
        data: {},
    };
}

/**
 * Seed test data for an organization
 * Creates: Channel, Warehouse, Product, SKU, Inventory, Customer, Order, Shipment
 */
export async function seedOrganizationData(
    prisma: PrismaClient,
    orgId: string,
): Promise<{
    channelId: string;
    warehouseId: string;
    productId: string;
    skuId: string;
    inventoryId: string;
    customerId: string;
    orderId: string;
    shipmentId: string;
    shippingAccountId: string;
}> {
    // Create channel
    const channel = await prisma.channel.create({
        data: {
            id: uuidv4(),
            organizationId: orgId,
            name: `Test Channel ${Date.now()}`,
            type: ChannelType.SHOPIFY,
            config: {
                shopUrl: 'test-store.myshopify.com',
                accessToken: 'test-token',
            },
            isActive: true,
        },
    });

    // Create warehouse
    const warehouse = await prisma.warehouse.create({
        data: {
            id: uuidv4(),
            organizationId: orgId,
            name: 'Test Warehouse',
            code: `WH-${Date.now()}`,
            address: {
                street: '123 Test St',
                city: 'Riyadh',
                country: 'SA',
            },
            isActive: true,
        },
    });

    // Create product
    const product = await prisma.product.create({
        data: {
            id: uuidv4(),
            organizationId: orgId,
            channelId: channel.id,
            name: 'Test Product',
            description: 'A test product for isolation testing',
        },
    });

    // Create SKU
    const sku = await prisma.sKU.create({
        data: {
            id: uuidv4(),
            organizationId: orgId,
            productId: product.id,
            sku: `SKU-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            barcode: `BAR-${Date.now()}`,
        },
    });

    // Create inventory level
    const inventoryLevel = await prisma.inventoryLevel.create({
        data: {
            id: uuidv4(),
            organizationId: orgId,
            skuId: sku.id,
            warehouseId: warehouse.id,
            available: 100,
            reserved: 10,
            damaged: 0,
        },
    });

    // Create customer
    const customer = await prisma.customer.create({
        data: {
            id: uuidv4(),
            organizationId: orgId,
            firstName: 'Test',
            lastName: 'Customer',
            email: `customer-${Date.now()}@test.com`,
            phone: '+966501234567',
        },
    });

    // Create shipping account
    const shippingAccount = await prisma.shippingAccount.create({
        data: {
            id: uuidv4(),
            organizationId: orgId,
            carrierType: 'DHL',
            name: 'Test DHL Account',
            credentials: {
                apiKey: 'test-api-key',
                apiSecret: 'test-api-secret',
            },
            testMode: true,
            isActive: true,
        },
    });

    // Create order
    const order = await prisma.order.create({
        data: {
            id: uuidv4(),
            organizationId: orgId,
            channelId: channel.id,
            customerId: customer.id,
            externalOrderId: `EXT-${Date.now()}`,
            orderNumber: `ORD-${Date.now()}`,
            status: 'NEW',
            paymentStatus: 'PENDING',
            shippingAddress: {
                firstName: 'Test',
                lastName: 'Customer',
                street1: '123 Test St',
                city: 'Riyadh',
                postalCode: '12345',
                country: 'SA',
            },
            subtotal: 100.00,
            shippingCost: 15.00,
            taxAmount: 17.25,
            discountAmount: 0,
            totalAmount: 132.25,
            currency: 'SAR',
            orderDate: new Date(),
        },
    });

    // Create order item
    await prisma.orderItem.create({
        data: {
            id: uuidv4(),
            orderId: order.id,
            skuId: sku.id,
            name: 'Test Product',
            quantity: 1,
            unitPrice: 100.00,
            totalPrice: 100.00,
            taxAmount: 15.00,
            discountAmount: 0,
        },
    });

    // Create shipment
    const shipment = await prisma.shipment.create({
        data: {
            id: uuidv4(),
            organizationId: orgId,
            orderId: order.id,
            carrierType: 'DHL',
            shippingAccountId: shippingAccount.id,
            trackingNumber: `TRACK-${Date.now()}`,
            status: ShipmentStatus.CREATED,
        },
    });

    return {
        channelId: channel.id,
        warehouseId: warehouse.id,
        productId: product.id,
        skuId: sku.id,
        inventoryId: inventoryLevel.id,
        customerId: customer.id,
        orderId: order.id,
        shipmentId: shipment.id,
        shippingAccountId: shippingAccount.id,
    };
}

/**
 * Clean up test organization data
 */
export async function cleanupTestOrganization(
    prisma: PrismaClient,
    orgId: string,
): Promise<void> {
    // Prisma will cascade delete related records due to onDelete: Cascade
    await prisma.organization.delete({
        where: { id: orgId },
    }).catch(() => {
        // Ignore errors if already deleted
    });
}

/**
 * Clean up all test data (for afterAll hooks)
 */
export async function cleanupAllTestData(
    prisma: PrismaClient,
    orgIds: string[],
): Promise<void> {
    for (const orgId of orgIds) {
        await cleanupTestOrganization(prisma, orgId);
    }
}
