import { useState } from "react";
import { Plus, User, X, ShoppingBag } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { CartItem } from "./Cart";

export interface ClientCart {
  id: string;
  clientName: string;
  clientPhone?: string;        // Optional
  referralSource?: string; // Optional
  deliveryAddress?: string;      // Optional
  items: CartItem[];
  discount: number;
  extraDiscount?: number;
  createdAt: string;
  tax: number;
  advancePaid?: number;
}

interface CartManagerProps {
  carts: ClientCart[];
  activeCartId: string | null;
  onSelectCart: (cartId: string) => void;
  onCreateCart: (clientName: string) => void;
  onCloseCart: (cartId: string) => void;
}

export function CartManager({
  carts,
  activeCartId,
  onSelectCart,
  onCreateCart,
  onCloseCart,
}: CartManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");

  const handleCreateCart = () => {
    if (newClientName.trim()) {
      onCreateCart(newClientName.trim());
      setNewClientName("");
      setIsDialogOpen(false);
    }
  };

  const getCartTotal = (cart: ClientCart) => {
    return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const getCartItemCount = (cart: ClientCart) => {
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Active Client Carts</CardTitle>
            <Button onClick={() => setIsDialogOpen(true)} size="sm">
              <Plus className="size-4 mr-2" />
              New Cart
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {carts.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="size-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No active carts</p>
              <p className="text-sm text-gray-400 mt-1">
                Create a new cart to start serving a client
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {carts.map((cart) => (
                <div
                  key={cart.id}
                  className={`p-4 border rounded-lg cursor-pointer transition ${
                    cart.id === activeCartId
                      ? "border-blue-500 bg-blue-50"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => onSelectCart(cart.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="size-4 text-gray-500" />
                        <h3 className="font-medium">{cart.clientName}</h3>
                        {cart.id === activeCartId && (
                          <Badge className="bg-blue-500">Active</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>
                          {getCartItemCount(cart)} {getCartItemCount(cart) === 1 ? "item" : "items"}
                        </span>
                        <span className="font-semibold">
                          ₹{getCartTotal(cart).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Created: {new Date(cart.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Close cart for ${cart.clientName}? This will remove all items.`
                          )
                        ) {
                          onCloseCart(cart.id);
                        }
                      }}
                    >
                      <X className="size-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Client Cart</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm text-gray-600 mb-2 block">
              Client Name
            </label>
            <Input
              type="text"
              placeholder="Enter client name..."
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCart()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateCart}
              disabled={!newClientName.trim()}
            >
              Create Cart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
