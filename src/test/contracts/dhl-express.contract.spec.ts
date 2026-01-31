/**
 * DHL Express API Contract Tests
 * 
 * Uses Pact to verify API contract compatibility with DHL Express.
 * These tests ensure our integration remains compatible with DHL's API.
 * 
 * @packageDocumentation
 */

import { PactV4, LogLevel, MatchersV3 } from '@pact-foundation/pact';
import * as path from 'path';

const { like, eachLike, datetime, string, integer, boolean, number } = MatchersV3;

describe('DHL Express API Contract', () => {
  // Create pact provider
  const provider = new PactV4({
    consumer: 'Rappit',
    provider: 'DHLExpress',
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: (process.env.PACT_LOG_LEVEL as LogLevel) || 'warn',
  });

  describe('POST /mydhlapi/shipments', () => {
    it('creates shipment with valid credentials and request', async () => {
      await provider
        .addInteraction()
        .given('valid DHL API credentials')
        .uponReceiving('a request to create shipment')
        .withRequest('POST', '/mydhlapi/shipments', (builder) => {
          builder
            .headers({
              'Authorization': like('Basic YXBpS2V5OmFwaVNlY3JldA=='),
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              plannedShippingDateAndTime: like('2024-01-20T10:00:00+03:00'),
              pickup: like({
                isRequested: false,
              }),
              productCode: string('P'),
              localProductCode: string('P'),
              getRateEstimates: boolean(false),
              accounts: eachLike({
                typeCode: string('shipper'),
                number: string('123456789'),
              }),
              outputImageProperties: {
                printerDPI: integer(300),
                encodingFormat: string('pdf'),
                imageOptions: eachLike({
                  typeCode: string('label'),
                  templateName: string('ECOM26_84_001'),
                }),
              },
              customerDetails: {
                shipperDetails: {
                  postalAddress: {
                    postalCode: string('12345'),
                    cityName: string('Riyadh'),
                    countryCode: string('SA'),
                    addressLine1: string('123 Main Street'),
                  },
                  contactInformation: {
                    email: string('shipper@example.com'),
                    phone: string('+966500000000'),
                    companyName: string('Test Company'),
                    fullName: string('John Doe'),
                  },
                },
                receiverDetails: {
                  postalAddress: {
                    postalCode: string('23456'),
                    cityName: string('Jeddah'),
                    countryCode: string('SA'),
                    addressLine1: string('456 Other Street'),
                  },
                  contactInformation: {
                    email: string('receiver@example.com'),
                    phone: string('+966500000001'),
                    companyName: string('Receiver Company'),
                    fullName: string('Jane Doe'),
                  },
                },
              },
              content: {
                packages: eachLike({
                  weight: number(1.5),
                  dimensions: {
                    length: number(30),
                    width: number(20),
                    height: number(10),
                  },
                }),
                isCustomsDeclarable: boolean(false),
                description: string('Test shipment'),
                incoterm: string('DAP'),
                unitOfMeasurement: string('metric'),
              },
            });
        })
        .willRespondWith(201, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              shipmentTrackingNumber: string('1234567890'),
              trackingUrl: string('https://www.dhl.com/track?id=1234567890'),
              packages: eachLike({
                referenceNumber: integer(1),
                trackingNumber: string('JD014600004853000810'),
                trackingUrl: string('https://www.dhl.com/track?id=JD014600004853000810'),
              }),
              documents: eachLike({
                typeCode: string('label'),
                imageFormat: string('PDF'),
                content: string('base64encodedcontent...'),
              }),
              onDemandDeliveryURL: like(''),
              shipmentDetails: eachLike({
                serviceHandlingFeatureCodes: like([]),
                volumetricWeight: number(1.0),
                billingCode: string('SENDER'),
                serviceContentCode: string('X'),
                customerDetails: like({}),
                originServiceArea: like({
                  code: string('RUH'),
                  description: string('RIYADH-SAUDI ARABIA'),
                  facilityCode: string('RUH'),
                }),
                destinationServiceArea: like({
                  code: string('JED'),
                  description: string('JEDDAH-SAUDI ARABIA'),
                  facilityCode: string('JED'),
                }),
                dhlRoutingCode: string('RUH+AAAAA00+'),
                dhlRoutingDataId: string('1J'),
                deliveryDateCode: string('S'),
                deliveryTimeCode: string(''),
                pickupDetails: like({}),
              }),
              estimatedDeliveryDate: like({
                estimatedDeliveryDate: string('2024-01-22'),
                estimatedDeliveryType: string('QDDC'),
              }),
            });
        })
        .executeTest(async (mockServer) => {
          const authString = Buffer.from('apiKey:apiSecret').toString('base64');
          const response = await fetch(`${mockServer.url}/mydhlapi/shipments`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              plannedShippingDateAndTime: '2024-01-20T10:00:00+03:00',
              pickup: { isRequested: false },
              productCode: 'P',
              localProductCode: 'P',
              getRateEstimates: false,
              accounts: [{ typeCode: 'shipper', number: '123456789' }],
              outputImageProperties: {
                printerDPI: 300,
                encodingFormat: 'pdf',
                imageOptions: [{ typeCode: 'label', templateName: 'ECOM26_84_001' }],
              },
              customerDetails: {
                shipperDetails: {
                  postalAddress: {
                    postalCode: '12345',
                    cityName: 'Riyadh',
                    countryCode: 'SA',
                    addressLine1: '123 Main Street',
                  },
                  contactInformation: {
                    email: 'shipper@example.com',
                    phone: '+966500000000',
                    companyName: 'Test Company',
                    fullName: 'John Doe',
                  },
                },
                receiverDetails: {
                  postalAddress: {
                    postalCode: '23456',
                    cityName: 'Jeddah',
                    countryCode: 'SA',
                    addressLine1: '456 Other Street',
                  },
                  contactInformation: {
                    email: 'receiver@example.com',
                    phone: '+966500000001',
                    companyName: 'Receiver Company',
                    fullName: 'Jane Doe',
                  },
                },
              },
              content: {
                packages: [{ weight: 1.5, dimensions: { length: 30, width: 20, height: 10 } }],
                isCustomsDeclarable: false,
                description: 'Test shipment',
                incoterm: 'DAP',
                unitOfMeasurement: 'metric',
              },
            }),
          });

          expect(response.status).toBe(201);
          const data = await response.json();
          expect(data.shipmentTrackingNumber).toBeDefined();
        });
    });

    it('returns 401 for invalid credentials', async () => {
      await provider
        .addInteraction()
        .given('invalid DHL API credentials')
        .uponReceiving('a shipment request with invalid credentials')
        .withRequest('POST', '/mydhlapi/shipments', (builder) => {
          builder.headers({
            'Authorization': like('Basic aW52YWxpZDppbnZhbGlk'),
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          });
        })
        .willRespondWith(401, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              instance: string('/mydhlapi/shipments'),
              detail: string('Invalid credentials'),
              title: string('Unauthorized'),
              message: string('Invalid credentials'),
              status: integer(401),
            });
        })
        .executeTest(async (mockServer) => {
          const authString = Buffer.from('invalid:invalid').toString('base64');
          const response = await fetch(`${mockServer.url}/mydhlapi/shipments`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({}),
          });

          expect(response.status).toBe(401);
        });
    });
  });

  describe('GET /track/shipments', () => {
    it('returns tracking information for valid tracking number', async () => {
      await provider
        .addInteraction()
        .given('valid DHL API credentials and tracking number exists')
        .uponReceiving('a request for tracking information')
        .withRequest('GET', '/track/shipments', (builder) => {
          builder
            .headers({
              'Authorization': like('Basic YXBpS2V5OmFwaVNlY3JldA=='),
              'Accept': 'application/json',
            })
            .query({ trackingNumber: '1234567890' });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              shipments: eachLike({
                id: string('1234567890'),
                service: string('EXPRESS WORLDWIDE'),
                origin: {
                  address: {
                    addressLocality: string('Riyadh'),
                    countryCode: string('SA'),
                  },
                  servicePoint: like({}),
                },
                destination: {
                  address: {
                    addressLocality: string('Jeddah'),
                    countryCode: string('SA'),
                  },
                  servicePoint: like({}),
                },
                status: {
                  timestamp: string('2024-01-20T15:30:00'),
                  location: {
                    address: {
                      addressLocality: string('Jeddah'),
                      countryCode: string('SA'),
                    },
                  },
                  statusCode: string('transit'),
                  status: string('In Transit'),
                  description: string('Shipment in transit'),
                  remark: like(''),
                  nextSteps: like(''),
                },
                estimatedTimeOfDelivery: string('2024-01-22T18:00:00'),
                estimatedTimeOfDeliveryRemark: like(''),
                details: {
                  proofOfDelivery: like({}),
                  totalNumberOfPieces: integer(1),
                  pieceIds: eachLike(string('JD014600004853000810')),
                  weight: {
                    value: number(1.5),
                    unitText: string('kg'),
                  },
                  dimensions: like({}),
                },
                events: eachLike({
                  timestamp: string('2024-01-20T10:00:00'),
                  location: {
                    address: {
                      addressLocality: string('Riyadh'),
                      countryCode: string('SA'),
                    },
                  },
                  statusCode: string('PU'),
                  status: string('Picked Up'),
                  description: string('Shipment picked up'),
                }),
              }),
            });
        })
        .executeTest(async (mockServer) => {
          const authString = Buffer.from('apiKey:apiSecret').toString('base64');
          const response = await fetch(
            `${mockServer.url}/track/shipments?trackingNumber=1234567890`,
            {
              headers: {
                'Authorization': `Basic ${authString}`,
                'Accept': 'application/json',
              },
            },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.shipments).toBeDefined();
          expect(Array.isArray(data.shipments)).toBe(true);
        });
    });
  });

  describe('POST /mydhlapi/address-validate', () => {
    it('validates address with valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid DHL API credentials')
        .uponReceiving('a request to validate address')
        .withRequest('POST', '/mydhlapi/address-validate', (builder) => {
          builder
            .headers({
              'Authorization': like('Basic YXBpS2V5OmFwaVNlY3JldA=='),
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              type: string('delivery'),
              countryCode: string('SA'),
              postalCode: string('12345'),
              cityName: string('Riyadh'),
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              address: eachLike({
                postalCode: string('12345'),
                cityName: string('Riyadh'),
                countryCode: string('SA'),
                serviceArea: {
                  code: string('RUH'),
                  description: string('RIYADH-SAUDI ARABIA'),
                  facilityCode: string('RUH'),
                  GMTOffset: string('+03:00'),
                },
              }),
              warnings: like([]),
            });
        })
        .executeTest(async (mockServer) => {
          const authString = Buffer.from('apiKey:apiSecret').toString('base64');
          const response = await fetch(`${mockServer.url}/mydhlapi/address-validate`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${authString}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              type: 'delivery',
              countryCode: 'SA',
              postalCode: '12345',
              cityName: 'Riyadh',
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.address).toBeDefined();
        });
    });
  });
});
