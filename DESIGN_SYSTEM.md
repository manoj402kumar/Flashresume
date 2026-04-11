# FlashResume Design System

## 🎨 Color Palette

### Primary Colors
```css
--color-primary: #006859           /* Teal - Trust, professionalism */
--color-primary-container: #12f8d7 /* Bright cyan - Energy, innovation */
--color-on-primary-container: #00594c
```

### Surface Colors
```css
--color-surface: #f5f6f7                    /* Page background */
--color-surface-container-low: #eff1f2      /* Card backgrounds */
--color-surface-container-lowest: #ffffff   /* Elevated cards */
--color-surface-container-high: #e9ebec     /* Disabled states */
```

### Text Colors
```css
--color-on-background: #2c2f30      /* Primary text */
--color-on-surface-variant: #595c5d /* Secondary text */
```

### Semantic Colors
```css
--color-error: #b31b25              /* Errors, warnings */
--color-secondary-container: #1cede1 /* Accents */
--color-tertiary-container: #09c4fd  /* Highlights */
```

### Gradients
```css
.flash-gradient {
  background: linear-gradient(135deg, #006859 0%, #12f8d7 100%);
}
```

---

## 📐 Spacing Scale

### Padding/Margin
```
xs: 2   (8px)
sm: 4   (16px)
md: 6   (24px)
lg: 8   (32px)
xl: 10  (40px)
2xl: 12 (48px)
3xl: 20 (80px)
4xl: 32 (128px)
```

### Section Spacing
```jsx
<section className="py-32">  // 128px vertical
<section className="py-20">  // 80px vertical (smaller sections)
```

### Card Spacing
```jsx
<div className="p-8">   // Standard card
<div className="p-10">  // Premium card
```

### Grid Gaps
```jsx
<div className="gap-8">   // Standard gap
<div className="gap-12">  // Large gap
<div className="gap-20">  // Section gap
```

---

## 🔤 Typography

### Font Families
```css
--font-sans: "Inter"      /* Body text */
--font-headline: "Manrope" /* Headlines */
```

### Font Sizes
```jsx
// Hero Headlines
text-5xl md:text-7xl  // 48px → 72px

// Section Headers
text-4xl md:text-5xl  // 36px → 48px

// Subheadings
text-2xl             // 24px

// Body Large
text-xl              // 20px

// Body Regular
text-base            // 16px

// Small Text
text-sm              // 14px

// Labels
text-xs uppercase    // 12px
```

### Font Weights
```jsx
font-bold       // 700 - Headlines
font-semibold   // 600 - Subheadings
font-medium     // 500 - Emphasis
font-normal     // 400 - Body
```

### Line Heights
```jsx
leading-[1.1]    // Tight - Large headlines
leading-tight    // Headlines
leading-normal   // Body text
leading-relaxed  // Comfortable reading
```

---

## 🎭 Border Radius

### Scale
```jsx
rounded-xl        // 12px - Inputs, small cards
rounded-2xl       // 16px - Medium cards
rounded-[2rem]    // 32px - Large cards (signature style)
rounded-[2.5rem]  // 40px - Extra large
rounded-[3rem]    // 48px - Hero cards
rounded-full      // Buttons, badges, avatars
```

---

## 🌟 Shadows

### Hierarchy
```jsx
// Subtle
shadow-sm

// Standard
shadow-xl

// Elevated
shadow-2xl

// Branded (with color)
shadow-xl shadow-primary/5
shadow-2xl shadow-primary/10
shadow-lg shadow-primary/20
```

---

## ✨ Effects

### Glassmorphism
```css
.glass-header {
  backdrop-blur-xl bg-white/70
}
```

### Blur Orbs (Decorative)
```jsx
<div className="absolute -top-6 -right-6 w-24 h-24 
     bg-primary-container/20 blur-3xl rounded-full -z-10" />
```

### Gradients
```jsx
className="flash-gradient"  // Primary gradient
```

---

## 🎬 Animations

### Entrance Animations
```jsx
// Fade + Slide from left
initial={{ opacity: 0, x: -20 }}
animate={{ opacity: 1, x: 0 }}
transition={{ duration: 0.6 }}

// Fade + Slide from bottom
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6, delay: 0.2 }}
```

### Hover Effects
```jsx
// Lift
whileHover={{ y: -8 }}

// Scale
hover:scale-105

// Opacity
hover:opacity-90

// Shadow
hover:shadow-xl
```

### Click Effects
```jsx
active:scale-95  // Tactile feedback
```

### Scroll Animations
```jsx
whileInView={{ opacity: 1, x: 0 }}
viewport={{ once: true }}
```

### Transition Speeds
```jsx
transition-all duration-300  // Standard
transition-all duration-500  // Smooth
transition-all duration-1000 // Dramatic
```

---

## 🔘 Buttons

### Primary Button
```jsx
<button className="flash-gradient text-white font-bold px-8 py-4 
                   rounded-full hover:opacity-90 transition-all 
                   active:scale-95 shadow-xl shadow-primary/25">
  Button Text
</button>
```

### Secondary Button
```jsx
<button className="bg-white border-2 border-gray-300 text-gray-700 
                   font-semibold px-6 py-4 rounded-xl 
                   hover:bg-gray-50 transition-all">
  Button Text
</button>
```

### Ghost Button
```jsx
<button className="text-primary font-medium hover:underline">
  Button Text
</button>
```

---

## 📦 Cards

### Standard Card
```jsx
<div className="bg-surface-container-low rounded-[2rem] p-8 
                shadow-xl hover:shadow-2xl transition-all">
  Content
</div>
```

### Elevated Card
```jsx
<div className="bg-surface-container-lowest rounded-[2rem] p-10 
                shadow-2xl shadow-primary/5 border border-primary/5">
  Content
</div>
```

### Interactive Card
```jsx
<motion.div
  whileHover={{ y: -8 }}
  className="bg-surface-container-lowest rounded-[2rem] p-10 
             transition-all duration-300 shadow-sm 
             hover:shadow-xl hover:shadow-primary/5">
  Content
</motion.div>
```

---

## 🎯 Icons

### Sizes
```jsx
w-4 h-4   // Small (16px) - Inline
w-5 h-5   // Medium (20px) - Buttons
w-6 h-6   // Large (24px) - Features
w-8 h-8   // XL (32px) - Section icons
w-12 h-12 // 2XL (48px) - Hero icons
```

### Icon Containers
```jsx
<div className="w-16 h-16 rounded-2xl bg-primary-container/20 
                flex items-center justify-center">
  <Icon className="text-primary w-8 h-8" />
</div>
```

---

## 📱 Responsive Breakpoints

```jsx
// Mobile first
className="text-base"

// Tablet (768px+)
className="md:text-lg"

// Desktop (1024px+)
className="lg:text-xl"

// Large Desktop (1280px+)
className="xl:text-2xl"
```

---

## 🎨 Usage Examples

### Hero Section
```jsx
<section className="max-w-7xl mx-auto px-6 py-20 md:py-32 
                    grid lg:grid-cols-12 gap-12 items-center">
  <div className="lg:col-span-7">
    <h1 className="font-headline text-5xl md:text-7xl font-bold 
                   tracking-tight text-on-background leading-[1.1] mb-8">
      Your headline
    </h1>
  </div>
</section>
```

### Feature Cards
```jsx
<div className="grid md:grid-cols-3 gap-8">
  <motion.div whileHover={{ y: -8 }}
              className="bg-surface-container-lowest p-10 
                         rounded-[2rem] shadow-sm hover:shadow-xl">
    <div className="w-16 h-16 rounded-2xl bg-primary-container/20 
                    flex items-center justify-center mb-8">
      <Icon className="text-primary w-8 h-8" />
    </div>
    <h3 className="font-headline text-2xl font-bold mb-4">Title</h3>
    <p className="text-on-surface-variant leading-relaxed">Description</p>
  </motion.div>
</div>
```

---

## 🚀 Implementation Checklist

- [ ] Replace all hardcoded colors with semantic tokens
- [ ] Use consistent spacing scale (py-32, p-8, gap-8)
- [ ] Apply rounded-[2rem] to all cards
- [ ] Add Framer Motion entrance animations
- [ ] Add hover effects (y: -8, opacity: 0.9)
- [ ] Add decorative blur orbs
- [ ] Use flash-gradient for CTAs
- [ ] Add shadow-primary/5 to elevated elements
- [ ] Use font-headline for all headers
- [ ] Add active:scale-95 to all buttons
