import { Truck, Package, MapPin, Clock, CheckCircle, AlertCircle } from 'lucide-react';

export function ShippingManagement() {
  const carriers = [
    {
      name: 'DHL',
      logo: '📦',
      status: 'active',
      activeShipments: 45,
      deliveredToday: 23,
      apiStatus: 'connected',
      lastSync: '2025-12-12 10:45',
    },
    {
      name: 'FedEx',
      logo: '✈️',
      status: 'active',
      activeShipments: 32,
      deliveredToday: 18,
      apiStatus: 'connected',
      lastSync: '2025-12-12 10:42',
    },
  ];

  const shipments = [
    {
      trackingNumber: 'DHL123456789',
      orderId: '#ORD-1236',
      carrier: 'DHL',
      customer: 'خالد محمود عبدالله',
      destination: 'الرياض، المملكة العربية السعودية',
      status: 'in_transit',
      statusLabel: 'قيد التوصيل',
      createdAt: '2025-12-11 16:45',
      estimatedDelivery: '2025-12-13',
      lastUpdate: 'في مركز الفرز - الرياض',
      lastUpdateTime: '2025-12-12 08:30',
    },
    {
      trackingNumber: 'FDX123456789',
      orderId: '#ORD-1237',
      carrier: 'FedEx',
      customer: 'نورة سعيد الأحمد',
      destination: 'جدة، المملكة العربية السعودية',
      status: 'out_for_delivery',
      statusLabel: 'خرج للتسليم',
      createdAt: '2025-12-11 14:20',
      estimatedDelivery: '2025-12-12',
      lastUpdate: 'خرج للتسليم من مركز جدة',
      lastUpdateTime: '2025-12-12 07:00',
    },
    {
      trackingNumber: 'DHL987654321',
      orderId: '#ORD-1238',
      carrier: 'DHL',
      customer: 'عبدالله يوسف محمد',
      destination: 'الدمام، المملكة العربية السعودية',
      status: 'delivered',
      statusLabel: 'تم التسليم',
      createdAt: '2025-12-10 11:30',
      estimatedDelivery: '2025-12-12',
      deliveredAt: '2025-12-12 09:15',
      lastUpdate: 'تم التسليم - تم التوقيع من قبل المستلم',
      lastUpdateTime: '2025-12-12 09:15',
    },
    {
      trackingNumber: 'FDX987654321',
      orderId: '#ORD-1239',
      carrier: 'FedEx',
      customer: 'سارة حسن علي',
      destination: 'مكة، المملكة العربية السعودية',
      status: 'exception',
      statusLabel: 'استثناء',
      createdAt: '2025-12-09 08:45',
      estimatedDelivery: '2025-12-11',
      lastUpdate: 'فشل محاولة التسليم - المستلم غير متواجد',
      lastUpdateTime: '2025-12-11 14:20',
    },
  ];

  const readyToShip = [
    {
      orderId: '#ORD-1240',
      customer: 'عمر محمد الحسني',
      items: 3,
      weight: '1.2 كجم',
      destination: 'الرياض',
      preferredCarrier: 'DHL',
    },
    {
      orderId: '#ORD-1241',
      customer: 'ليلى أحمد سالم',
      items: 2,
      weight: '0.8 كجم',
      destination: 'جدة',
      preferredCarrier: 'FedEx',
    },
  ];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      in_transit: 'bg-blue-100 text-blue-700 border-blue-200',
      out_for_delivery: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      delivered: 'bg-green-100 text-green-700 border-green-200',
      exception: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-5 h-5" />;
      case 'exception':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Truck className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl mb-2">إدارة الشحن</h1>
        <p className="text-gray-600">تكامل DHL و FedEx مع التتبع المباشر</p>
      </div>

      {/* Carriers Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {carriers.map((carrier) => (
          <div key={carrier.name} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl">{carrier.logo}</div>
                <div>
                  <h3 className="text-xl">{carrier.name}</h3>
                  <p className="text-sm text-gray-600">آخر مزامنة: {carrier.lastSync}</p>
                </div>
              </div>
              <span className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                <CheckCircle className="w-4 h-4" />
                متصل
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-600 mb-1">شحنات نشطة</p>
                <p className="text-2xl">{carrier.activeShipments}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">تم التسليم اليوم</p>
                <p className="text-2xl text-green-600">{carrier.deliveredToday}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ready to Ship */}
      {readyToShip.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl mb-4 text-blue-900">جاهز للشحن ({readyToShip.length})</h2>
          <div className="space-y-3">
            {readyToShip.map((order) => (
              <div key={order.orderId} className="bg-white rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Package className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium">{order.orderId} - {order.customer}</p>
                    <p className="text-sm text-gray-600">
                      {order.items} منتجات • {order.weight} • {order.destination}
                    </p>
                  </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Truck className="w-4 h-4" />
                  <span>إنشاء شحنة {order.preferredCarrier}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Shipments */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl">الشحنات النشطة</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {shipments.map((shipment) => (
            <div key={shipment.trackingNumber} className="p-6 hover:bg-gray-50">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${getStatusColor(shipment.status)} border`}>
                    {getStatusIcon(shipment.status)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg">{shipment.trackingNumber}</h3>
                      <span className="text-sm text-gray-500">{shipment.orderId}</span>
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                        {shipment.carrier}
                      </span>
                    </div>
                    <p className="text-gray-700 mb-1">{shipment.customer}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {shipment.destination}
                      </span>
                      {shipment.estimatedDelivery && !shipment.deliveredAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          التسليم المتوقع: {shipment.estimatedDelivery}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`px-4 py-2 rounded-full border text-sm ${getStatusColor(shipment.status)}`}>
                  {shipment.statusLabel}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mr-[68px]">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-600">{shipment.lastUpdateTime}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-900">{shipment.lastUpdate}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
