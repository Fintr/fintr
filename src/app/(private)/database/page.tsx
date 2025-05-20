import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Edit,
  Trash2,
  Plus,
  Save,
  X,
  Database,
  Tag,
  Settings,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const DatabasePage = () => {
  const [activeTab, setActiveTab] = useState("categories");
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [newItem, setNewItem] = useState<any>(null);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (activeTab === "categories") {
          const { data, error } = await supabase
            .from("categories")
            .select("*")
            .order("name", { ascending: true });

          if (error) throw error;
          setCategories(data || []);
        } else if (activeTab === "settings") {
          const { data, error } = await supabase
            .from("settings")
            .select("*")
            .order("name", { ascending: true });

          if (error) throw error;
          setSettings(data || []);
        }
      } catch (error) {
        console.error(`Error loading ${activeTab}:`, error);
        // If no data in Supabase, use mock data
        if (activeTab === "categories") {
          setCategories([
            {
              id: 1,
              name: "Food",
              color: "#008080",
              user_id: "current-user-id",
            },
            {
              id: 2,
              name: "Transportation",
              color: "#D6A3A1",
              user_id: "current-user-id",
            },
            {
              id: 3,
              name: "Entertainment",
              color: "#FF6F61",
              user_id: "current-user-id",
            },
            {
              id: 4,
              name: "Utilities",
              color: "#800020",
              user_id: "current-user-id",
            },
            {
              id: 5,
              name: "Shopping",
              color: "#CC5500",
              user_id: "current-user-id",
            },
            {
              id: 6,
              name: "House",
              color: "#3D8D7F",
              user_id: "current-user-id",
            },
          ]);
        } else if (activeTab === "settings") {
          setSettings([
            {
              id: 1,
              name: "Currency",
              value: "PHP",
              user_id: "current-user-id",
            },
            {
              id: 2,
              name: "Theme",
              value: "Light",
              user_id: "current-user-id",
            },
            {
              id: 3,
              name: "Notifications",
              value: "On",
              user_id: "current-user-id",
            },
          ]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [activeTab]);

  const handleEdit = (item: any) => {
    setEditingItem({ ...item });
  };

  const handleSave = async () => {
    try {
      const table = activeTab === "categories" ? "categories" : "settings";
      const { data, error } = await supabase
        .from(table)
        .update(editingItem)
        .eq("id", editingItem.id)
        .select();

      if (error) throw error;

      // Update local state
      if (activeTab === "categories") {
        setCategories(
          categories.map((item) =>
            item.id === editingItem.id ? editingItem : item,
          ),
        );
      } else {
        setSettings(
          settings.map((item) =>
            item.id === editingItem.id ? editingItem : item,
          ),
        );
      }

      setEditingItem(null);
    } catch (error) {
      console.error("Error saving item:", error);
      // Update local state anyway for demo purposes
      if (activeTab === "categories") {
        setCategories(
          categories.map((item) =>
            item.id === editingItem.id ? editingItem : item,
          ),
        );
      } else {
        setSettings(
          settings.map((item) =>
            item.id === editingItem.id ? editingItem : item,
          ),
        );
      }
      setEditingItem(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const table = activeTab === "categories" ? "categories" : "settings";
      const { error } = await supabase.from(table).delete().eq("id", id);

      if (error) throw error;

      // Update local state
      if (activeTab === "categories") {
        setCategories(categories.filter((item) => item.id !== id));
      } else {
        setSettings(settings.filter((item) => item.id !== id));
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      // Update local state anyway for demo purposes
      if (activeTab === "categories") {
        setCategories(categories.filter((item) => item.id !== id));
      } else {
        setSettings(settings.filter((item) => item.id !== id));
      }
    }
  };

  const handleAddNew = () => {
    if (activeTab === "categories") {
      setNewItem({ name: "", color: "#008080", user_id: "current-user-id" });
    } else {
      setNewItem({ name: "", value: "", user_id: "current-user-id" });
    }
  };

  const handleSaveNew = async () => {
    try {
      const table = activeTab === "categories" ? "categories" : "settings";
      const { data, error } = await supabase
        .from(table)
        .insert([newItem])
        .select();

      if (error) throw error;

      // Update local state
      if (activeTab === "categories") {
        setCategories([...categories, data[0]]);
      } else {
        setSettings([...settings, data[0]]);
      }

      setNewItem(null);
    } catch (error) {
      console.error("Error adding new item:", error);
      // Add to local state anyway with a temporary ID for demo purposes
      const tempId = Date.now();
      if (activeTab === "categories") {
        setCategories([...categories, { ...newItem, id: tempId }]);
      } else {
        setSettings([...settings, { ...newItem, id: tempId }]);
      }
      setNewItem(null);
    }
  };

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-[#0A3D62]">Database</h1>
        <p className="text-[#0A3D62]/70 mt-2">
          Manage your categories and application settings
        </p>
      </div>
      
      <Tabs
        defaultValue={activeTab}
        className="w-full"
        onValueChange={setActiveTab}
      >
        <TabsList className="grid grid-cols-2 mb-8">
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Categories
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Categories</CardTitle>
                <CardDescription>
                  Manage your transaction categories
                </CardDescription>
              </div>
              <Button
                onClick={handleAddNew}
                className="bg-[#0A3D62] hover:bg-[#0A3D62]/80"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Category
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading categories...</div>
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      {editingItem && editingItem.id === category.id ? (
                        <div className="flex items-center gap-4 w-full">
                          <div className="flex-grow">
                            <Label
                              htmlFor="category-name"
                              className="mb-1 block"
                            >
                              Name
                            </Label>
                            <Input
                              id="category-name"
                              value={editingItem.name}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  name: e.target.value,
                                })
                              }
                              className="mb-2"
                            />
                          </div>
                          <div className="w-32">
                            <Label
                              htmlFor="category-color"
                              className="mb-1 block"
                            >
                              Color
                            </Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                id="category-color"
                                value={editingItem.color}
                                onChange={(e) =>
                                  setEditingItem({
                                    ...editingItem,
                                    color: e.target.value,
                                  })
                                }
                                className="w-8 h-8 rounded cursor-pointer"
                              />
                              <Input
                                value={editingItem.color}
                                onChange={(e) =>
                                  setEditingItem({
                                    ...editingItem,
                                    color: e.target.value,
                                  })
                                }
                                className="flex-grow"
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              onClick={handleSave}
                              className="bg-green-600 hover:bg-green-700"
                              size="sm"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => setEditingItem(null)}
                              variant="outline"
                              size="sm"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <div
                              className="w-6 h-6 rounded-full mr-3"
                              style={{ backgroundColor: category.color }}
                            ></div>
                            <span className="font-medium text-[#0A3D62]">
                              {category.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleEdit(category)}
                              variant="outline"
                              size="sm"
                              className="text-[#0A3D62]"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(category.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {newItem && (
                    <div className="p-4 border rounded-lg border-dashed border-[#0A3D62]/50 bg-[#0A3D62]/5">
                      <div className="flex items-center gap-4 w-full">
                        <div className="flex-grow">
                          <Label
                            htmlFor="new-category-name"
                            className="mb-1 block"
                          >
                            Name
                          </Label>
                          <Input
                            id="new-category-name"
                            value={newItem.name}
                            onChange={(e) =>
                              setNewItem({ ...newItem, name: e.target.value })
                            }
                            className="mb-2"
                            placeholder="Enter category name"
                          />
                        </div>
                        <div className="w-32">
                          <Label
                            htmlFor="new-category-color"
                            className="mb-1 block"
                          >
                            Color
                          </Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              id="new-category-color"
                              value={newItem.color}
                              onChange={(e) =>
                                setNewItem({
                                  ...newItem,
                                  color: e.target.value,
                                })
                              }
                              className="w-8 h-8 rounded cursor-pointer"
                            />
                            <Input
                              value={newItem.color}
                              onChange={(e) =>
                                setNewItem({
                                  ...newItem,
                                  color: e.target.value,
                                })
                              }
                              className="flex-grow"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            onClick={handleSaveNew}
                            className="bg-green-600 hover:bg-green-700"
                            size="sm"
                            disabled={!newItem.name}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => setNewItem(null)}
                            variant="outline"
                            size="sm"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {categories.length === 0 && !newItem && (
                    <div className="text-center py-8 text-[#0A3D62]/70">
                      No categories found. Click "Add Category" to create one.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Manage your application settings
                </CardDescription>
              </div>
              <Button
                onClick={handleAddNew}
                className="bg-[#0A3D62] hover:bg-[#0A3D62]/80"
              >
                <Plus className="h-4 w-4 mr-2" /> Add Setting
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Loading settings...</div>
              ) : (
                <div className="space-y-4">
                  {settings.map((setting) => (
                    <div
                      key={setting.id}
                      className="p-4 border rounded-lg flex items-center justify-between"
                    >
                      {editingItem && editingItem.id === setting.id ? (
                        <div className="flex items-center gap-4 w-full">
                          <div className="flex-grow">
                            <Label
                              htmlFor="setting-name"
                              className="mb-1 block"
                            >
                              Name
                            </Label>
                            <Input
                              id="setting-name"
                              value={editingItem.name}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  name: e.target.value,
                                })
                              }
                              className="mb-2"
                            />
                          </div>
                          <div className="flex-grow">
                            <Label
                              htmlFor="setting-value"
                              className="mb-1 block"
                            >
                              Value
                            </Label>
                            <Input
                              id="setting-value"
                              value={editingItem.value}
                              onChange={(e) =>
                                setEditingItem({
                                  ...editingItem,
                                  value: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Button
                              onClick={handleSave}
                              className="bg-green-600 hover:bg-green-700"
                              size="sm"
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => setEditingItem(null)}
                              variant="outline"
                              size="sm"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <div className="flex flex-col">
                              <span className="font-medium text-[#0A3D62]">
                                {setting.name}
                              </span>
                              <span className="text-sm text-[#0A3D62]/70">
                                {setting.value}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              onClick={() => handleEdit(setting)}
                              variant="outline"
                              size="sm"
                              className="text-[#0A3D62]"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(setting.id)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {newItem && (
                    <div className="p-4 border rounded-lg border-dashed border-[#0A3D62]/50 bg-[#0A3D62]/5">
                      <div className="flex items-center gap-4 w-full">
                        <div className="flex-grow">
                          <Label
                            htmlFor="new-setting-name"
                            className="mb-1 block"
                          >
                            Name
                          </Label>
                          <Input
                            id="new-setting-name"
                            value={newItem.name}
                            onChange={(e) =>
                              setNewItem({ ...newItem, name: e.target.value })
                            }
                            className="mb-2"
                            placeholder="Enter setting name"
                          />
                        </div>
                        <div className="flex-grow">
                          <Label
                            htmlFor="new-setting-value"
                            className="mb-1 block"
                          >
                            Value
                          </Label>
                          <Input
                            id="new-setting-value"
                            value={newItem.value}
                            onChange={(e) =>
                              setNewItem({
                                ...newItem,
                                value: e.target.value,
                              })
                            }
                            placeholder="Enter setting value"
                          />
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            onClick={handleSaveNew}
                            className="bg-green-600 hover:bg-green-700"
                            size="sm"
                            disabled={!newItem.name}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            onClick={() => setNewItem(null)}
                            variant="outline"
                            size="sm"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.length === 0 && !newItem && (
                    <div className="text-center py-8 text-[#0A3D62]/70">
                      No settings found. Click "Add Setting" to create one.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DatabasePage;
