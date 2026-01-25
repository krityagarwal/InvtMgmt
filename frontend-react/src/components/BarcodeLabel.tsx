import Barcode from 'react-barcode';

interface BarcodeLabelProps {
  code: string;
  name: string;
  price: number;
}

export function BarcodeLabel({ code, name, price }: BarcodeLabelProps) {
  return (
    <div className="print-only flex flex-col items-center justify-center p-4 border w-[4in] h-[2in] mx-auto bg-white text-black">
      <h2 className="text-xl font-bold mb-1">{name}</h2>
      <Barcode 
        value={code} 
        width={2} 
        height={60} 
        fontSize={16}
        format="CODE128"
      />
      <p className="text-lg font-semibold mt-1">Price: ${price.toFixed(2)}</p>
    </div>
  );
}