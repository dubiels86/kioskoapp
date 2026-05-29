'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Users, Shield, Coins, Banknote, Settings as SettingsIcon, Store } from 'lucide-react'
import { UsersTab } from './users-tab'
import { RolesTab } from './roles-tab'
import { CurrencyTab } from './currency-tab'
import { DenominationsTab } from './denominations-tab'
import { GeneralTab } from './general-tab'

export function SettingsView() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="users" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="currency" className="gap-1.5">
            <Coins className="h-4 w-4" />
            Moneda
          </TabsTrigger>
          <TabsTrigger value="denominations" className="gap-1.5">
            <Banknote className="h-4 w-4" />
            Denominaciones
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-1.5">
            <Store className="h-4 w-4" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesTab />
        </TabsContent>

        <TabsContent value="currency" className="mt-4">
          <CurrencyTab />
        </TabsContent>

        <TabsContent value="denominations" className="mt-4">
          <DenominationsTab />
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <GeneralTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
