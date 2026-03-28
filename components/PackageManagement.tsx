import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Plus,
    Pencil,
    Trash2,
    Boxes,
    Loader2,
    Star,
    Tag,
} from 'lucide-react';
import api from '../services/api';

// ─── Types ──────────────────────────────────────────────────────

interface PackageFormData {
    code: string;
    name: string;
    description: string;
    badge: string;
    price_1_month: string;
    price_1_month_enabled: boolean;
    price_6_months: string;
    price_6_months_enabled: boolean;
    price_1_year: string;
    price_1_year_enabled: boolean;
    is_featured: boolean;
    is_active: boolean;
    app_ids: number[];
}

interface AdminPackage {
    id: number;
    code: string;
    name: string;
    is_active: boolean;
    is_featured: boolean;
    badge?: string;
    price_1_month?: number;
    price_6_months?: number;
    price_1_year?: number;
    sum_price_1_month?: number;
    sum_price_6_months?: number;
    sum_price_1_year?: number;
    app_count: number;
    included_apps?: string;
}

interface StoreAppItem {
    id: number;
    code: string;
    name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────

const EMPTY_FORM: PackageFormData = {
    code: '',
    name: '',
    description: '',
    badge: '',
    price_1_month: '',
    price_1_month_enabled: true,
    price_6_months: '',
    price_6_months_enabled: true,
    price_1_year: '',
    price_1_year_enabled: true,
    is_featured: false,
    is_active: true,
    app_ids: [],
};

// Auto-calculate savings %: (1 - pkgPrice/sumPrice) * 100
const calcSavings = (pkgPrice?: number, sumPrice?: number): number | null => {
    if (!pkgPrice || !sumPrice || sumPrice <= 0 || pkgPrice >= sumPrice) return null;
    return Math.round((1 - pkgPrice / sumPrice) * 1000) / 10;
};

const formatPrice = (price?: number) => {
    if (!price) return '—';
    return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
};

// ─── Component ───────────────────────────────────────────────────

export const PackageManagement: React.FC = () => {
    const [packages, setPackages] = useState<AdminPackage[]>([]);
    const [availableApps, setAvailableApps] = useState<StoreAppItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<PackageFormData>(EMPTY_FORM);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        try {
            setLoading(true);
            const [pkgRes, appsRes] = await Promise.all([
                api.store.getAdminPackages(),
                api.admin.getApps(),
            ]);
            setPackages(pkgRes.items || []);
            setAvailableApps(appsRes.items || []);
        } catch (e) {
            console.error('Failed to load packages:', e);
        } finally {
            setLoading(false);
        }
    };

    const openCreate = () => {
        setEditId(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEdit = (pkg: AdminPackage) => {
        setEditId(pkg.id);
        setForm({
            code: pkg.code,
            name: pkg.name,
            description: '',
            badge: pkg.badge || '',
            price_1_month: pkg.price_1_month?.toString() || '',
            price_1_month_enabled: true,
            price_6_months: pkg.price_6_months?.toString() || '',
            price_6_months_enabled: true,
            price_1_year: pkg.price_1_year?.toString() || '',
            price_1_year_enabled: true,
            is_featured: pkg.is_featured,
            is_active: pkg.is_active,
            app_ids: [],
        });
        setDialogOpen(true);
    };

    const closeDialog = () => {
        if (!saving) {
            setDialogOpen(false);
            setEditId(null);
            setForm(EMPTY_FORM);
        }
    };

    const toggleAppId = (id: number) => {
        setForm(prev => ({
            ...prev,
            app_ids: prev.app_ids.includes(id)
                ? prev.app_ids.filter(a => a !== id)
                : [...prev.app_ids, id],
        }));
    };

    const handleSave = async () => {
        if (!form.code || !form.name) {
            alert('Vui lòng nhập Code và Tên gói.');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                code: form.code,
                name: form.name,
                description: form.description || undefined,
                badge: form.badge || undefined,
                price_1_month: form.price_1_month ? parseFloat(form.price_1_month) : undefined,
                price_1_month_enabled: form.price_1_month_enabled,
                price_6_months: form.price_6_months ? parseFloat(form.price_6_months) : undefined,
                price_6_months_enabled: form.price_6_months_enabled,
                price_1_year: form.price_1_year ? parseFloat(form.price_1_year) : undefined,
                price_1_year_enabled: form.price_1_year_enabled,
                is_featured: form.is_featured,
                is_active: form.is_active,
                app_ids: form.app_ids,
            };

            if (editId) {
                await api.store.updatePackage(editId, payload);
            } else {
                await api.store.createPackage(payload as any);
            }

            closeDialog();
            await loadAll();
        } catch (e: any) {
            alert('Lỗi: ' + e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`Xóa gói "${name}"? Thao tác này không thể hoàn tác.`)) return;
        setDeleting(id);
        try {
            await api.store.deletePackage(id);
            await loadAll();
        } catch (e: any) {
            alert('Lỗi: ' + e.message);
        } finally {
            setDeleting(null);
        }
    };

    // ─── Render ────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <Boxes className="w-6 h-6 text-amber-500" />
                        Package Management
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Quản lý các gói phần mềm hiển thị trong Store.
                    </p>
                </div>
                <Button onClick={openCreate} className="bg-amber-500 hover:bg-amber-600 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Tạo gói mới
                </Button>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Danh sách gói phần mềm ({packages.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead>Tên gói</TableHead>
                                <TableHead>Phần mềm</TableHead>
                                <TableHead>Giá (1T / 6T / 1N)</TableHead>
                                <TableHead>Badge</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {packages.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                        <Boxes className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                        <p>Chưa có gói nào. Tạo gói đầu tiên!</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                packages.map(pkg => (
                                    <TableRow key={pkg.id} className="group">
                                        <TableCell>
                                            <div>
                                                <p className="font-semibold text-sm flex items-center gap-1.5">
                                                    {!!pkg.is_featured && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                                                    {pkg.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">{pkg.code}</p>
                                                {/* Show best savings across all durations */}
                                                {(() => {
                                                    const s1 = calcSavings(pkg.price_1_month, pkg.sum_price_1_month);
                                                    const s6 = calcSavings(pkg.price_6_months, pkg.sum_price_6_months);
                                                    const s12 = calcSavings(pkg.price_1_year, pkg.sum_price_1_year);
                                                    const best = [s1, s6, s12].filter(Boolean).sort((a, b) => (b ?? 0) - (a ?? 0))[0];
                                                    if (!best) return null;
                                                    return (
                                                        <span className="text-[10px] text-emerald-600 font-bold">
                                                            Tiết kiệm đến {best}%
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs text-muted-foreground max-w-[200px]">
                                                <p className="font-semibold text-foreground">{pkg.app_count} phần mềm</p>
                                                <p className="truncate">{pkg.included_apps || '—'}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            <div className="space-y-0.5">
                                                <p>{formatPrice(pkg.price_1_month)}</p>
                                                <p className="text-muted-foreground">{formatPrice(pkg.price_6_months)}</p>
                                                <p className="text-muted-foreground">{formatPrice(pkg.price_1_year)}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {pkg.badge ? (
                                                <Badge variant="outline" className="text-[10px]">
                                                    <Tag className="w-3 h-3 mr-1" />
                                                    {pkg.badge}
                                                </Badge>
                                            ) : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={pkg.is_active ? 'success' : 'outline'}>
                                                {pkg.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8"
                                                    onClick={() => openEdit(pkg)}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDelete(pkg.id, pkg.name)}
                                                    disabled={deleting === pkg.id}
                                                >
                                                    {deleting === pkg.id
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : <Trash2 className="w-4 h-4" />
                                                    }
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Boxes className="w-5 h-5 text-amber-500" />
                            {editId ? 'Chỉnh sửa gói' : 'Tạo gói phần mềm mới'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Basic info */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Code <span className="text-destructive">*</span></Label>
                                <Input
                                    placeholder="VD: PKG_OFFICE"
                                    value={form.code}
                                    onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                    disabled={!!editId}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Tên gói <span className="text-destructive">*</span></Label>
                                <Input
                                    placeholder="VD: Gói Văn Phòng"
                                    value={form.name}
                                    onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Badge <span className="text-xs text-muted-foreground">(tuỳ chọn)</span></Label>
                                <Input
                                    placeholder="VD: HOT, BEST VALUE"
                                    value={form.badge}
                                    onChange={e => setForm(prev => ({ ...prev, badge: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="flex items-center gap-1.5">
                                    Tiết kiệm
                                    <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Tự động tính</span>
                                </Label>
                                <div className="h-10 border rounded-md bg-muted/50 flex items-center px-3 text-sm text-muted-foreground">
                                    % tính từ giá app lẻ
                                </div>
                            </div>
                        </div>

                        {/* Pricing */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold">Bảng giá</Label>
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { label: '1 Tháng', field: 'price_1_month', enabledField: 'price_1_month_enabled' },
                                    { label: '6 Tháng', field: 'price_6_months', enabledField: 'price_6_months_enabled' },
                                    { label: '1 Năm', field: 'price_1_year', enabledField: 'price_1_year_enabled' },
                                ].map(({ label, field, enabledField }) => (
                                    <div key={field} className="space-y-1.5 border rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-1">
                                            <Label className="text-xs">{label}</Label>
                                            <Switch
                                                checked={form[enabledField as keyof PackageFormData] as boolean}
                                                onCheckedChange={v => setForm(prev => ({ ...prev, [enabledField]: v }))}
                                            />
                                        </div>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            value={form[field as keyof PackageFormData] as string}
                                            onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                                            disabled={!form[enabledField as keyof PackageFormData] as boolean}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* App selector */}
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">
                                Chọn phần mềm trong gói ({form.app_ids.length} đã chọn)
                            </Label>
                            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                                {availableApps.length === 0 ? (
                                    <p className="text-sm text-muted-foreground p-3">Không có phần mềm nào.</p>
                                ) : availableApps.map(app => (
                                    <div
                                        key={app.id}
                                        className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                                        onClick={() => toggleAppId(app.id)}
                                    >
                                        {/* stopPropagation prevents the parent div onClick from
                                            firing a second time when the Checkbox button is clicked */}
                                        <div onClick={e => e.stopPropagation()}>
                                            <Checkbox
                                                checked={form.app_ids.includes(app.id)}
                                                onCheckedChange={() => toggleAppId(app.id)}
                                            />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{app.name}</p>
                                            <p className="text-xs text-muted-foreground">{app.code}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="flex gap-6">
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="is_featured"
                                    checked={form.is_featured}
                                    onCheckedChange={v => setForm(prev => ({ ...prev, is_featured: v }))}
                                />
                                <Label htmlFor="is_featured" className="cursor-pointer flex items-center gap-1">
                                    <Star className="w-3.5 h-3.5 text-amber-500" /> Featured
                                </Label>
                            </div>
                            <div className="flex items-center gap-3">
                                <Switch
                                    id="is_active"
                                    checked={form.is_active}
                                    onCheckedChange={v => setForm(prev => ({ ...prev, is_active: v }))}
                                />
                                <Label htmlFor="is_active" className="cursor-pointer">Active</Label>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeDialog} disabled={saving}>Huỷ</Button>
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                        >
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {editId ? 'Cập nhật' : 'Tạo gói'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
