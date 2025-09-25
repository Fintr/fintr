"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { PhilippinesTaxCalculator } from "../ui/philippines-tax-calculator"

export function TaxCalculatorDemo() {
  const [grossIncome, setGrossIncome] = useState<number>(50000)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Philippines Tax Calculator Demo</CardTitle>
          <p className="text-gray-600">
            Enter your gross income to see the breakdown of deductions and net income calculation.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gross-income">Gross Income (PHP)</Label>
            <Input
              id="gross-income"
              type="number"
              value={grossIncome}
              onChange={(e) => setGrossIncome(parseFloat(e.target.value) || 0)}
              placeholder="Enter your gross income"
              className="text-lg"
            />
          </div>
          
          {grossIncome > 0 && (
            <PhilippinesTaxCalculator 
              grossIncome={grossIncome}
              className="w-full"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}


