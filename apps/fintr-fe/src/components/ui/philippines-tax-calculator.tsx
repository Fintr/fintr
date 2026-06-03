"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./card"
import { Label } from "./label"
import { Input } from "./input"
import { formatCurrency } from "@/lib/utils"

interface TaxCalculationResult {
  grossIncome: number
  sssContribution: number
  philhealthContribution: number
  pagibigContribution: number
  incomeTax: number
  totalDeductions: number
  netIncome: number
}

interface PhilippinesTaxCalculatorProps {
  grossIncome: number
  deductTaxes?: boolean
  deductContributions?: boolean
  onCalculationChange?: (result: TaxCalculationResult) => void
  className?: string
}

export function PhilippinesTaxCalculator({
  grossIncome,
  deductTaxes = false,
  deductContributions = false,
  onCalculationChange,
  className
}: PhilippinesTaxCalculatorProps) {
  const [result, setResult] = useState<TaxCalculationResult>({
    grossIncome: 0,
    sssContribution: 0,
    philhealthContribution: 0,
    pagibigContribution: 0,
    incomeTax: 0,
    totalDeductions: 0,
    netIncome: 0
  })

  // SSS Contribution calculation (2025 SSS Table)
  const calculateSSS = (monthlySalary: number): number => {
    if (monthlySalary <= 0) return 0
    
    const sssBrackets = [
      { min: 0, max: 5249.99, contribution: 250 },
      { min: 5250, max: 5749.99, contribution: 275 },
      { min: 5750, max: 6249.99, contribution: 300 },
      { min: 6250, max: 6749.99, contribution: 325 },
      { min: 6750, max: 7249.99, contribution: 350 },
      { min: 7250, max: 7749.99, contribution: 375 },
      { min: 7750, max: 8249.99, contribution: 400 },
      { min: 8250, max: 8749.99, contribution: 425 },
      { min: 8750, max: 9249.99, contribution: 450 },
      { min: 9250, max: 9749.99, contribution: 475 },
      { min: 9750, max: 10249.99, contribution: 500 },
      { min: 10250, max: 10749.99, contribution: 525 },
      { min: 10750, max: 11249.99, contribution: 550 },
      { min: 11250, max: 11749.99, contribution: 575 },
      { min: 11750, max: 12249.99, contribution: 600 },
      { min: 12250, max: 12749.99, contribution: 625 },
      { min: 12750, max: 13249.99, contribution: 650 },
      { min: 13250, max: 13749.99, contribution: 675 },
      { min: 13750, max: 14249.99, contribution: 700 },
      { min: 14250, max: 14749.99, contribution: 725 },
      { min: 14750, max: 15249.99, contribution: 750 },
      { min: 15250, max: 15749.99, contribution: 775 },
      { min: 15750, max: 16249.99, contribution: 800 },
      { min: 16250, max: 16749.99, contribution: 825 },
      { min: 16750, max: 17249.99, contribution: 850 },
      { min: 17250, max: 17749.99, contribution: 875 },
      { min: 17750, max: 18249.99, contribution: 900 },
      { min: 18250, max: 18749.99, contribution: 925 },
      { min: 18750, max: 19249.99, contribution: 950 },
      { min: 19250, max: 19749.99, contribution: 975 },
      { min: 19750, max: 20249.99, contribution: 1000 },
      { min: 20250, max: 20749.99, contribution: 1025 },
      { min: 20750, max: 21249.99, contribution: 1050 },
      { min: 21250, max: 21749.99, contribution: 1075 },
      { min: 21750, max: 22249.99, contribution: 1100 },
      { min: 22250, max: 22749.99, contribution: 1125 },
      { min: 22750, max: 23249.99, contribution: 1150 },
      { min: 23250, max: 23749.99, contribution: 1175 },
      { min: 23750, max: 24249.99, contribution: 1200 },
      { min: 24250, max: 24749.99, contribution: 1225 },
      { min: 24750, max: 25249.99, contribution: 1250 },
      { min: 25250, max: 25749.99, contribution: 1275 },
      { min: 25750, max: 26249.99, contribution: 1300 },
      { min: 26250, max: 26749.99, contribution: 1325 },
      { min: 26750, max: 27249.99, contribution: 1350 },
      { min: 27250, max: 27749.99, contribution: 1375 },
      { min: 27750, max: 28249.99, contribution: 1400 },
      { min: 28250, max: 28749.99, contribution: 1425 },
      { min: 28750, max: 29249.99, contribution: 1450 },
      { min: 29250, max: 29749.99, contribution: 1475 },
      { min: 29750, max: 30249.99, contribution: 1500 },
      { min: 30250, max: 30749.99, contribution: 1525 },
      { min: 30750, max: 31249.99, contribution: 1550 },
      { min: 31250, max: 31749.99, contribution: 1575 },
      { min: 31750, max: 32249.99, contribution: 1600 },
      { min: 32250, max: 32749.99, contribution: 1625 },
      { min: 32750, max: 33249.99, contribution: 1650 },
      { min: 33250, max: 33749.99, contribution: 1675 },
      { min: 33750, max: 34249.99, contribution: 1700 },
      { min: 34250, max: 34749.99, contribution: 1725 },
      { min: 34750, max: Number.MAX_SAFE_INTEGER, contribution: 1750 }
    ]

    const bracket = sssBrackets.find(bracket =>
      monthlySalary >= bracket.min && monthlySalary <= bracket.max
    )

    return bracket?.contribution ?? 1750
  }

  // PhilHealth Contribution calculation
  const calculatePhilHealth = (monthlySalary: number): number => {
    if (monthlySalary <= 0) return 0
    
    const incomeCeiling = 100000 // DOH/BIR-mandated ceiling
    const cappedSalary = Math.min(monthlySalary, incomeCeiling)
    const employeeShare = 0.025 // 2.5% employee share (5% total, split 50/50)
    return cappedSalary * employeeShare
  }

  // Pag-IBIG Contribution calculation
  const calculatePagIBIG = (monthlySalary: number): number => {
    if (monthlySalary <= 0) return 0
    
    const threshold = 1500
    const lowRate = 0.01
    const highRate = 0.02
    const maxContribution = 200
    
    const rate = monthlySalary <= threshold ? lowRate : highRate
    return Math.min(monthlySalary * rate, maxContribution)
  }

  // Income Tax calculation
  const calculateIncomeTax = (annualTaxableIncome: number): number => {
    if (annualTaxableIncome <= 0) return 0
    
    const taxBrackets = [
      { min: 0, max: 250000, baseAmount: 0, rate: 0 },
      { min: 250000, max: 400000, baseAmount: 0, rate: 0.15 },
      { min: 400000, max: 800000, baseAmount: 22500, rate: 0.20 },
      { min: 800000, max: 2000000, baseAmount: 102500, rate: 0.25 },
      { min: 2000000, max: 8000000, baseAmount: 402500, rate: 0.30 },
      { min: 8000000, max: Infinity, baseAmount: 2202500, rate: 0.35 }
    ]
    
    for (const bracket of taxBrackets) {
      if (annualTaxableIncome <= bracket.max) {
        const excess = Math.max(0, annualTaxableIncome - bracket.min)
        return bracket.baseAmount + (excess * bracket.rate)
      }
    }
    return 0
  }

  // Calculate all deductions
  useEffect(() => {
    if (grossIncome <= 0) {
      const emptyResult: TaxCalculationResult = {
        grossIncome: 0,
        sssContribution: 0,
        philhealthContribution: 0,
        pagibigContribution: 0,
        incomeTax: 0,
        totalDeductions: 0,
        netIncome: 0
      }
      setResult(emptyResult)
      onCalculationChange?.(emptyResult)
      return
    }

    // Calculate monthly contributions
    const sssContribution = deductContributions ? calculateSSS(grossIncome) : 0
    const philHealthContribution = deductContributions ? calculatePhilHealth(grossIncome) : 0
    const pagibigContribution = deductContributions ? calculatePagIBIG(grossIncome) : 0
    const totalContributions = sssContribution + philHealthContribution + pagibigContribution

    // Calculate taxable income (monthly salary minus contributions)
    const taxableIncome = grossIncome - totalContributions
    const annualTaxableIncome = taxableIncome * 12

    // Calculate annual tax and convert to monthly
    const annualTax = deductTaxes ? calculateIncomeTax(annualTaxableIncome) : 0
    const monthlyTax = annualTax / 12

    const totalDeductions = totalContributions + monthlyTax
    const netIncome = grossIncome - totalDeductions

    const calculationResult: TaxCalculationResult = {
      grossIncome,
      sssContribution,
      philhealthContribution: philHealthContribution,
      pagibigContribution,
      incomeTax: monthlyTax,
      totalDeductions,
      netIncome
    }

    setResult(calculationResult)
    onCalculationChange?.(calculationResult)
  }, [grossIncome, deductTaxes, deductContributions, onCalculationChange])

  return (
    <Card className={`w-full gap-1 px-2 ${className}`}>
      <CardHeader className="pb-2 md:px-4">
        <CardTitle className="text-xs font-medium">Tax & Contribution Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 md:px-4">
        {/* Gross Income Display */}
        <div className="rounded-md border border-blue-200 bg-blue-50 p-2 dark:border-blue-800/50 dark:bg-blue-950/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-blue-900 dark:text-blue-300">
              Monthly Gross Income
            </span>
            <span className="text-sm font-bold text-blue-900 dark:text-blue-300">
              {formatCurrency(grossIncome)}
            </span>
          </div>
        </div>

        {/* Deductions Breakdown */}
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-foreground">Deductions</h4>
          
          <div className="space-y-1">
            {deductContributions && (
              <>
                <div className="flex items-center justify-between border-b border-border py-1">
                  <span className="text-xs text-muted-foreground">SSS Contribution</span>
                  <span className="text-xs font-medium text-red-900 dark:text-red-400">
                    -{formatCurrency(result.sssContribution)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between border-b border-border py-1">
                  <span className="text-xs text-muted-foreground">PhilHealth Contribution</span>
                  <span className="text-xs font-medium text-red-900 dark:text-red-400">
                    -{formatCurrency(result.philhealthContribution)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between border-b border-border py-1">
                  <span className="text-xs text-muted-foreground">Pag-IBIG Contribution</span>
                  <span className="text-xs font-medium text-red-900 dark:text-red-400">
                    -{formatCurrency(result.pagibigContribution)}
                  </span>
                </div>
              </>
            )}
            
            {deductTaxes && (
              <div className="flex items-center justify-between border-b border-border py-1">
                <span className="text-xs text-muted-foreground">Income Tax</span>
                <span className="text-xs font-medium text-red-900 dark:text-red-400">
                  -{formatCurrency(result.incomeTax)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Total Deductions */}
        <div className="rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800/50 dark:bg-red-950/40">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-900 dark:text-red-400">
              Total Deductions
            </span>
            <span className="text-sm font-bold text-red-900 dark:text-red-400">
              -{formatCurrency(result.totalDeductions)}
            </span>
          </div>
        </div>

        {/* Net Income */}
        <div className="rounded-md border border-teal-600 bg-teal-50 p-2 dark:border-teal-700 dark:bg-teal-950/40">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-teal-600 dark:text-teal-400">
              Net Income
            </span>
            <span className="text-lg font-bold text-teal-600 dark:text-teal-400">
              {formatCurrency(result.netIncome)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
