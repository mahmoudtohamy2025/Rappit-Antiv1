/**
 * FedEx API Contract Tests
 * 
 * Uses Pact to verify API contract compatibility with FedEx.
 * These tests ensure our integration remains compatible with FedEx's API.
 * 
 * @packageDocumentation
 */

import { PactV4, LogLevel, MatchersV3 } from '@pact-foundation/pact';
import * as path from 'path';

const { like, eachLike, string, integer, boolean, number } = MatchersV3;

describe('FedEx API Contract', () => {
  // Create pact provider
  const provider = new PactV4({
    consumer: 'Rappit',
    provider: 'FedExAPI',
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: (process.env.PACT_LOG_LEVEL as LogLevel) || 'warn',
  });

  describe('POST /oauth/token', () => {
    it('returns access token for valid credentials', async () => {
      await provider
        .addInteraction()
        .given('valid FedEx API credentials')
        .uponReceiving('a request for OAuth token')
        .withRequest('POST', '/oauth/token', (builder) => {
          builder
            .headers({
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            })
            .body('grant_type=client_credentials&client_id=api_key&client_secret=api_secret');
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              access_token: string('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'),
              token_type: string('bearer'),
              expires_in: integer(3600),
              scope: string('CXS-TP'),
            });
        })
        .executeTest(async (mockServer) => {
          const formData = new URLSearchParams();
          formData.append('grant_type', 'client_credentials');
          formData.append('client_id', 'api_key');
          formData.append('client_secret', 'api_secret');

          const response = await fetch(`${mockServer.url}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formData.toString(),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.access_token).toBeDefined();
          expect(data.token_type).toBe('bearer');
        });
    });

    it('returns 401 for invalid credentials', async () => {
      await provider
        .addInteraction()
        .given('invalid FedEx API credentials')
        .uponReceiving('a request with invalid credentials')
        .withRequest('POST', '/oauth/token', (builder) => {
          builder
            .headers({
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            })
            .body('grant_type=client_credentials&client_id=invalid&client_secret=invalid');
        })
        .willRespondWith(401, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              error: string('invalid_client'),
              error_description: string('Invalid client credentials'),
            });
        })
        .executeTest(async (mockServer) => {
          const formData = new URLSearchParams();
          formData.append('grant_type', 'client_credentials');
          formData.append('client_id', 'invalid');
          formData.append('client_secret', 'invalid');

          const response = await fetch(`${mockServer.url}/oauth/token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formData.toString(),
          });

          expect(response.status).toBe(401);
        });
    });
  });

  describe('POST /ship/v1/shipments', () => {
    it('creates shipment with valid request', async () => {
      await provider
        .addInteraction()
        .given('valid FedEx API credentials and authenticated')
        .uponReceiving('a request to create shipment')
        .withRequest('POST', '/ship/v1/shipments', (builder) => {
          builder
            .headers({
              'Authorization': like('Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'),
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              labelResponseOptions: string('URL_ONLY'),
              requestedShipment: {
                shipper: {
                  contact: {
                    personName: string('John Doe'),
                    phoneNumber: string('966500000000'),
                    companyName: string('Test Company'),
                  },
                  address: {
                    streetLines: eachLike(string('123 Main Street')),
                    city: string('Riyadh'),
                    stateOrProvinceCode: string(''),
                    postalCode: string('12345'),
                    countryCode: string('SA'),
                  },
                },
                recipients: eachLike({
                  contact: {
                    personName: string('Jane Doe'),
                    phoneNumber: string('966500000001'),
                    companyName: string('Receiver Company'),
                  },
                  address: {
                    streetLines: eachLike(string('456 Other Street')),
                    city: string('Jeddah'),
                    stateOrProvinceCode: string(''),
                    postalCode: string('23456'),
                    countryCode: string('SA'),
                  },
                }),
                pickupType: string('DROPOFF_AT_FEDEX_LOCATION'),
                serviceType: string('FEDEX_INTERNATIONAL_PRIORITY'),
                packagingType: string('YOUR_PACKAGING'),
                shippingChargesPayment: {
                  paymentType: string('SENDER'),
                  payor: {
                    responsibleParty: {
                      accountNumber: {
                        value: string('123456789'),
                      },
                    },
                  },
                },
                labelSpecification: {
                  labelFormatType: string('COMMON2D'),
                  imageType: string('PDF'),
                  labelStockType: string('PAPER_LETTER'),
                },
                requestedPackageLineItems: eachLike({
                  weight: {
                    value: number(1.5),
                    units: string('KG'),
                  },
                  dimensions: {
                    length: integer(30),
                    width: integer(20),
                    height: integer(10),
                    units: string('CM'),
                  },
                }),
              },
              accountNumber: {
                value: string('123456789'),
              },
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              transactionId: string('xxxx-xxxx-xxxx-xxxx'),
              customerTransactionId: like(''),
              output: {
                transactionShipments: eachLike({
                  masterTrackingNumber: string('794644790138'),
                  serviceType: string('FEDEX_INTERNATIONAL_PRIORITY'),
                  shipDatestamp: string('2024-01-20'),
                  serviceName: string('FedEx International Priority'),
                  pieceResponses: eachLike({
                    netChargeAmount: number(150.00),
                    transactionDetails: eachLike({
                      transactionDetails: string(''),
                    }),
                    packageDocuments: eachLike({
                      url: string('https://www.fedex.com/label/...'),
                      docType: string('LABEL'),
                      contentType: string('application/pdf'),
                    }),
                    acceptanceTrackingNumber: string('794644790138'),
                    serviceCategory: string('EXPRESS'),
                    listCustomerTotalCharge: string('150.00 SAR'),
                    deliveryTimestamp: string('2024-01-22T18:00:00'),
                    trackingIdType: string('FEDEX'),
                    additionalChargesDiscount: number(0),
                    baseRateAmount: number(145.00),
                    netListRateAmount: number(150.00),
                  }),
                  completedShipmentDetail: {
                    usDomestic: boolean(false),
                    carrierCode: string('FDXE'),
                    masterTrackingId: {
                      trackingIdType: string('FEDEX'),
                      trackingNumber: string('794644790138'),
                    },
                    serviceDescription: {
                      description: string('FedEx International Priority'),
                      serviceId: string('EP1000000135'),
                      serviceType: string('FEDEX_INTERNATIONAL_PRIORITY'),
                    },
                    operationalDetail: like({
                      originLocationIds: eachLike(string('RUHA')),
                      commitDayOfWeek: string('MONDAY'),
                      destinationLocationIds: eachLike(string('JEDA')),
                      originServiceAreas: eachLike(string('A1')),
                    }),
                    shipmentRating: {
                      actualRateType: string('PAYOR_ACCOUNT_SHIPMENT'),
                      shipmentRateDetails: eachLike({
                        rateType: string('PAYOR_ACCOUNT_SHIPMENT'),
                        rateZone: string('1'),
                        pricingCode: string('ACTUAL'),
                        totalNetCharge: number(150.00),
                        totalNetFedExCharge: number(150.00),
                        totalBaseCharge: number(145.00),
                        totalSurcharges: number(5.00),
                        totalBillingWeight: {
                          value: number(1.5),
                          units: string('KG'),
                        },
                        currency: string('SAR'),
                      }),
                    },
                  },
                  shipmentDocuments: eachLike({
                    contentKey: string(''),
                    copiesToPrint: integer(1),
                    docType: string('COMMERCIAL_INVOICE'),
                    encodedLabel: like(''),
                    url: like(''),
                  }),
                }),
                alerts: like([]),
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/ship/v1/shipments`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              labelResponseOptions: 'URL_ONLY',
              requestedShipment: {
                shipper: {
                  contact: {
                    personName: 'John Doe',
                    phoneNumber: '966500000000',
                    companyName: 'Test Company',
                  },
                  address: {
                    streetLines: ['123 Main Street'],
                    city: 'Riyadh',
                    stateOrProvinceCode: '',
                    postalCode: '12345',
                    countryCode: 'SA',
                  },
                },
                recipients: [
                  {
                    contact: {
                      personName: 'Jane Doe',
                      phoneNumber: '966500000001',
                      companyName: 'Receiver Company',
                    },
                    address: {
                      streetLines: ['456 Other Street'],
                      city: 'Jeddah',
                      stateOrProvinceCode: '',
                      postalCode: '23456',
                      countryCode: 'SA',
                    },
                  },
                ],
                pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
                serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
                packagingType: 'YOUR_PACKAGING',
                shippingChargesPayment: {
                  paymentType: 'SENDER',
                  payor: {
                    responsibleParty: {
                      accountNumber: { value: '123456789' },
                    },
                  },
                },
                labelSpecification: {
                  labelFormatType: 'COMMON2D',
                  imageType: 'PDF',
                  labelStockType: 'PAPER_LETTER',
                },
                requestedPackageLineItems: [
                  {
                    weight: { value: 1.5, units: 'KG' },
                    dimensions: { length: 30, width: 20, height: 10, units: 'CM' },
                  },
                ],
              },
              accountNumber: { value: '123456789' },
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.output.transactionShipments).toBeDefined();
        });
    });
  });

  describe('POST /track/v1/trackingnumbers', () => {
    it('returns tracking information for valid tracking number', async () => {
      await provider
        .addInteraction()
        .given('valid FedEx API credentials and tracking number exists')
        .uponReceiving('a request for tracking information')
        .withRequest('POST', '/track/v1/trackingnumbers', (builder) => {
          builder
            .headers({
              'Authorization': like('Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'),
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              includeDetailedScans: boolean(true),
              trackingInfo: eachLike({
                trackingNumberInfo: {
                  trackingNumber: string('794644790138'),
                },
              }),
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              transactionId: string('xxxx-xxxx-xxxx-xxxx'),
              output: {
                completeTrackResults: eachLike({
                  trackingNumber: string('794644790138'),
                  trackResults: eachLike({
                    trackingNumberInfo: {
                      trackingNumber: string('794644790138'),
                      trackingNumberUniqueId: string(''),
                      carrierCode: string('FDXE'),
                    },
                    additionalTrackingInfo: {
                      hasAssociatedShipments: boolean(false),
                      nickname: like(''),
                      packageIdentifiers: like([]),
                      shipmentNotes: like(''),
                    },
                    distanceToDestination: like({}),
                    consolidationDetail: like([]),
                    returnDetail: like({}),
                    serviceDetail: {
                      type: string('FEDEX_INTERNATIONAL_PRIORITY'),
                      description: string('FedEx International Priority'),
                      shortDescription: string('IP'),
                    },
                    destinationLocation: like({}),
                    latestStatusDetail: {
                      scanLocation: like({
                        city: string('JEDDAH'),
                        stateOrProvinceCode: string(''),
                        countryCode: string('SA'),
                      }),
                      code: string('IT'),
                      derivedCode: string('IT'),
                      description: string('In transit'),
                      statusByLocale: string('In transit'),
                      ancillaryDetails: like([]),
                    },
                    serviceCommitMessage: like({}),
                    informationNotes: like([]),
                    error: like({}),
                    specialHandlings: like([]),
                    availableImages: like([]),
                    deliveryDetails: like({
                      actualDeliveryAddress: like({}),
                      locationType: like(''),
                      locationDescription: like(''),
                      deliveryAttempts: string('0'),
                      receivedByName: like(''),
                    }),
                    scanEvents: eachLike({
                      date: string('2024-01-20T15:30:00+03:00'),
                      derivedStatus: string('In transit'),
                      scanLocation: like({
                        city: string('RIYADH'),
                        stateOrProvinceCode: string(''),
                        countryCode: string('SA'),
                      }),
                      exceptionDescription: like(''),
                      eventDescription: string('Picked up'),
                      eventType: string('PU'),
                      derivedStatusCode: string('IT'),
                    }),
                    dateAndTimes: eachLike({
                      type: string('ACTUAL_PICKUP'),
                      dateTime: string('2024-01-20T10:00:00+03:00'),
                    }),
                    packageDetails: {
                      packagingDescription: like({}),
                      physicalPackagingType: string('YOUR_PACKAGING'),
                      sequenceNumber: string('1'),
                      count: string('1'),
                      weightAndDimensions: like({
                        weight: eachLike({
                          value: string('1.5'),
                          unit: string('KG'),
                        }),
                        dimensions: eachLike({
                          length: integer(30),
                          width: integer(20),
                          height: integer(10),
                          units: string('CM'),
                        }),
                      }),
                      packageContent: like([]),
                    },
                    shipmentDetails: {
                      possessionStatus: boolean(true),
                      weight: eachLike({
                        value: string('1.5'),
                        unit: string('KG'),
                      }),
                    },
                    reasonDetail: like({}),
                    availableNotifications: like([]),
                    shipperInformation: like({}),
                    recipientInformation: like({}),
                  }),
                }),
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/track/v1/trackingnumbers`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              includeDetailedScans: true,
              trackingInfo: [
                {
                  trackingNumberInfo: {
                    trackingNumber: '794644790138',
                  },
                },
              ],
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.output.completeTrackResults).toBeDefined();
        });
    });
  });

  describe('POST /rate/v1/rates/quotes', () => {
    it('returns rate quotes for valid request', async () => {
      await provider
        .addInteraction()
        .given('valid FedEx API credentials and authenticated')
        .uponReceiving('a request for rate quotes')
        .withRequest('POST', '/rate/v1/rates/quotes', (builder) => {
          builder
            .headers({
              'Authorization': like('Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'),
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            })
            .jsonBody({
              accountNumber: {
                value: string('123456789'),
              },
              requestedShipment: {
                shipper: {
                  address: {
                    city: string('Riyadh'),
                    postalCode: string('12345'),
                    countryCode: string('SA'),
                  },
                },
                recipient: {
                  address: {
                    city: string('Jeddah'),
                    postalCode: string('23456'),
                    countryCode: string('SA'),
                  },
                },
                pickupType: string('DROPOFF_AT_FEDEX_LOCATION'),
                requestedPackageLineItems: eachLike({
                  weight: {
                    value: number(1.5),
                    units: string('KG'),
                  },
                }),
              },
            });
        })
        .willRespondWith(200, (builder) => {
          builder
            .headers({ 'Content-Type': 'application/json' })
            .jsonBody({
              transactionId: string('xxxx-xxxx-xxxx-xxxx'),
              output: {
                rateReplyDetails: eachLike({
                  serviceType: string('FEDEX_INTERNATIONAL_PRIORITY'),
                  serviceName: string('FedEx International Priority'),
                  packagingType: string('YOUR_PACKAGING'),
                  commit: like({
                    dateDetail: like({
                      dayOfWeek: string('MONDAY'),
                      dayCxsFormat: string('Mon'),
                    }),
                    derivedShipmentSignature: like(''),
                    derivedOriginDetail: like({}),
                    derivedDestinationDetail: like({}),
                  }),
                  customerMessages: like([]),
                  ratedShipmentDetails: eachLike({
                    rateType: string('ACCOUNT'),
                    ratedWeightMethod: string('ACTUAL'),
                    totalBaseCharge: number(145.00),
                    totalNetCharge: number(150.00),
                    totalSurcharges: number(5.00),
                    totalNetFedExCharge: number(150.00),
                    shipmentRateDetail: {
                      rateZone: string('1'),
                      currency: string('SAR'),
                      pricingCode: string('ACTUAL'),
                      totalNetCharge: number(150.00),
                      totalBaseCharge: number(145.00),
                      totalBillingWeight: {
                        value: number(1.5),
                        units: string('KG'),
                      },
                      surcharges: like([]),
                    },
                  }),
                  anonymouslyAllowable: boolean(true),
                  operationalDetail: like({}),
                  signatureOptionType: string('ADULT'),
                }),
              },
            });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/rate/v1/rates/quotes`, {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify({
              accountNumber: { value: '123456789' },
              requestedShipment: {
                shipper: {
                  address: { city: 'Riyadh', postalCode: '12345', countryCode: 'SA' },
                },
                recipient: {
                  address: { city: 'Jeddah', postalCode: '23456', countryCode: 'SA' },
                },
                pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
                requestedPackageLineItems: [{ weight: { value: 1.5, units: 'KG' } }],
              },
            }),
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.output.rateReplyDetails).toBeDefined();
        });
    });
  });
});
