# =============================================================
# 6673-R for Basic Meta-Analysis (CPB)
# Converted from the PDF console transcript into a runnable script
# =============================================================
library(metafor)

# =============================================================
# 1. IMPORT AND INSPECT DATA
# =============================================================
# Use the original CSV when available; otherwise rebuild the data
# frame from the values printed in the PDF.
csv_file <- "6673-wk6-meta-data.csv"

if (file.exists(csv_file)) {
  dat <- read.csv(
    csv_file,
    na.strings = c("", "NA"),
    check.names = FALSE
  )
} else {
  dat <- data.frame(
    study = c("Ba et al.", "Bhatia et al.", "Cicek et al.", "Gan et al.",
              "Huang et al.", "Jiang et al.", "Kavadella et al.",
              "Svendsen et al.", "Tabuchi et al.", "Wu et al.", "Zeng et al."),
    year = c(rep(2024L, 10), 2025L),
    location = c("China", "India", "Turkiye", "China", "China", "China",
                 "Europe", "Norway", "Japan", "China", "China"),
    region = c("Asia", "Asia", "Europe", "Asia", "Asia", "Asia",
               "Europe", "Europe", "Asia", "Asia", "Asia"),
    course_type = c("Practice", "Theory", "Theory", "Theory", "Practice",
                    "Practice", "Theory", "Theory", "Theory", "Practice",
                    "Practice"),
    duration = c("2 weeks", "30 min", "5 days", "1 week", "Not reported",
                 "2 h", "4 weeks", "45 min", "10 min", "4 weeks", "2 weeks"),
    duration_group = c(">=1 week", "<1 week", "<1 week", ">=1 week", NA,
                       "<1 week", ">=1 week", "<1 week", "<1 week",
                       ">=1 week", ">=1 week"),
    timing_used = c(rep("Immediate", 9), "Delayed", "Delayed"),
    n_gai = c(39L, 50L, 56L, 54L, 32L, 31L, 39L, 15L, 27L, 31L, 21L),
    mean_gai = c(92.21, 1.70, 74.70, 138.46, 89.66, 15.78, 7.54, 7.70,
                 34.90, 86.44, 93.90),
    sd_gai = c(2.37, 1.33, 15.10, 26.97, 9.65, 3.62, 1.18, 2.00, 5.25,
               5.59, 3.65),
    n_control = c(38L, 50L, 59L, 56L, 32L, 30L, 31L, 16L, 28L, 30L, 21L),
    mean_control = c(92.38, 3.57, 78.50, 130.80, 77.04, 13.55, 6.94, 5.90,
                     39.75, 77.86, 90.33),
    sd_control = c(2.680, 0.498, 20.600, 25.560, 8.650, 3.330, 1.120,
                   2.500, 4.650, 4.160, 4.080),
    smd_paper = c(-0.07, -1.85, -0.21, 0.29, 1.36, 0.63, 0.51, 0.77,
                  -0.97, 1.71, 0.90),
    stringsAsFactors = FALSE
  )
}

str(dat)
dat

dat$slab <- paste(dat$study, dat$year)

# =============================================================
# 2. CALCULATE EFFECT SIZES: HEDGES' g
# =============================================================
es <- escalc(
  measure = "SMD",
  m1i = mean_gai,     sd1i = sd_gai,     n1i = n_gai,
  m2i = mean_control, sd2i = sd_control, n2i = n_control,
  data = dat,
  slab = slab
)
es$sei <- sqrt(es$vi)
es[, c(
  "slab",
  "n_gai", "mean_gai", "sd_gai",
  "n_control", "mean_control", "sd_control",
  "yi", "vi", "sei"
)]

# Compare computed Hedges' g with the values reported in the paper
data.frame(
  Study = es$slab,
  Hedges_g_R = round(es$yi, 2),
  SMD_paper = es$smd_paper
)

# =============================================================
# 3. RANDOM-EFFECTS META-ANALYSIS
# =============================================================
ma_re <- rma(
  yi, vi,
  data = es,
  method = "REML",
  test = "knha"
)

summary(ma_re)

# Prediction interval
pred <- predict(ma_re)
pred

# =============================================================
# 4. FIXED-EFFECT MODEL FOR COMPARISON
# =============================================================
ma_fe <- rma(
  yi, vi,
  data = es,
  method = "FE"
)
summary(ma_fe)

# =============================================================
# 5. FOREST PLOTS
# =============================================================
forest(
  ma_re,
  slab = es$slab,
  xlab = "Hedges' g",
  header = c("Study", "Hedges' g [95% CI]"),
  refline = 0,
  showweights = TRUE,
  addpred = TRUE,
  predstyle = "line"
)

forest(
  ma_re,
  slab = es$slab,
  xlim = c(-6.5, 4),
  alim = c(-2.5, 2.5),
  ilab = cbind(es$n_gai, es$n_control),
  ilab.lab = c("GAI n", "Control n"),
  ilab.xpos = c(-3.8, -3.0),
  xlab = "Hedges' g",
  header = c("Study", "Hedges' g [95% CI]"),
  refline = 0,
  showweights = TRUE,
  addpred = TRUE,
  predstyle = "line",
  cex = 0.85
)

# =============================================================
# 6. HETEROGENEITY: Q, TAU^2, TAU, I^2, AND PREDICTION INTERVAL
# =============================================================
summary(ma_re)
confint(ma_re)
predict(ma_re)

# =============================================================
# 7. SUBGROUP ANALYSIS / CATEGORICAL META-REGRESSION
# =============================================================
# -------------------------------------------------------------
# 7.1 Region: Asia vs Europe
# -------------------------------------------------------------
es$region <- factor(es$region, levels = c("Asia", "Europe"))

ma_asia <- rma(
  yi, vi,
  data = es,
  subset = region == "Asia",
  method = "REML",
  test = "knha"
)

ma_europe <- rma(
  yi, vi,
  data = es,
  subset = region == "Europe",
  method = "REML",
  test = "knha"
)

summary(ma_asia)
summary(ma_europe)

mod_region <- rma(
  yi, vi,
  mods = ~ region,
  data = es,
  method = "REML",
  test = "knha"
)

summary(mod_region)

# -------------------------------------------------------------
# 7.2 Course type: Theory vs Practice
# -------------------------------------------------------------
es$course_type <- factor(
  es$course_type,
  levels = c("Theory", "Practice")
)

ma_theory <- rma(
  yi, vi,
  data = es,
  subset = course_type == "Theory",
  method = "REML",
  test = "knha"
)

ma_practice <- rma(
  yi, vi,
  data = es,
  subset = course_type == "Practice",
  method = "REML",
  test = "knha"
)

summary(ma_theory)
summary(ma_practice)

mod_course <- rma(
  yi, vi,
  mods = ~ course_type,
  data = es,
  method = "REML",
  test = "knha"
)

summary(mod_course)

# Subgroup forest plot
es_course <- es[order(es$course_type), ]

forest(
  es_course$yi,
  vi = es_course$vi,
  slab = es_course$slab,
  rows = c(15:10, 6:2),
  ylim = c(-1, 18),
  xlim = c(-5, 3.5),
  alim = c(-2.5, 2.5),
  xlab = "Hedges' g",
  header = c("Study", "Hedges' g [95% CI]"),
  refline = 0,
  cex = 0.85
)

text(par("usr")[1], 17, "Theory course", pos = 4, font = 2)
addpoly(ma_theory, row = 8, mlab = "REML pooled effect: Theory")

text(par("usr")[1], 7, "Practice course", pos = 4, font = 2)
addpoly(ma_practice, row = 0, mlab = "REML pooled effect: Practice")

# -------------------------------------------------------------
# 7.3 Learning duration: <1 week vs >=1 week
# -------------------------------------------------------------
es$duration_group <- factor(
  es$duration_group,
  levels = c("<1 week", ">=1 week")
)

mod_duration <- rma(
  yi, vi,
  mods = ~ duration_group,
  data = es,
  subset = !is.na(duration_group),
  method = "REML",
  test = "knha"
)

summary(mod_duration)

# =============================================================
# 8. CONTINUOUS MODERATOR / META-REGRESSION
# =============================================================
# Convert the reported intervention duration to calendar days for a
# simple demonstration. This is only a rough operationalization.
es$duration_days <- NA_real_
es$duration_days[es$duration == "10 min"]  <- 10 / 1440
es$duration_days[es$duration == "30 min"]  <- 30 / 1440
es$duration_days[es$duration == "45 min"]  <- 45 / 1440
es$duration_days[es$duration == "2 h"]     <- 2 / 24
es$duration_days[es$duration == "5 days"]  <- 5
es$duration_days[es$duration == "1 week"]  <- 7
es$duration_days[es$duration == "2 weeks"] <- 14
es$duration_days[es$duration == "4 weeks"] <- 28

mod_days <- rma(
  yi, vi,
  mods = ~ duration_days,
  data = es,
  subset = !is.na(duration_days),
  method = "REML",
  test = "knha"
)

summary(mod_days)

# Bubble plot: point size reflects study weight.
regplot(
  mod_days,
  mod = "duration_days",
  xlab = "Learning duration (days)",
  ylab = "Hedges' g"
)

# =============================================================
# 9. FUNNEL PLOT AND FUNNEL-PLOT ASYMMETRY
# =============================================================
funnel(
  ma_re,
  yaxis = "sei",
  xlab = "Hedges' g",
  ylab = "Standard error"
)

# Egger-type regression test.
# With only 11 studies, power is limited.
regtest(
  ma_re,
  model = "lm"
)

# Rank-correlation test for asymmetry
ranktest(ma_re)

# =============================================================
# 10. FAIL-SAFE N: HISTORICAL / LIMITED SENSITIVITY ANALYSIS
# =============================================================
# Rosenthal: how many null studies would make the combined p-value > .05?
fsn(
  es$yi,
  es$vi,
  type = "Rosenthal",
  alpha = 0.05
)

# Orwin: how many null studies would reduce the pooled effect to g = 0.10?
fsn(
  es$yi,
  es$vi,
  type = "Orwin",
  target = 0.10
)

# =============================================================
# 11. TRIM-AND-FILL: SENSITIVITY ANALYSIS
# =============================================================
tf <- trimfill(ma_re)
summary(tf)

funnel(
  tf,
  yaxis = "sei",
  xlab = "Hedges' g",
  ylab = "Standard error"
)

# =============================================================
# 12. LEAVE-ONE-OUT SENSITIVITY ANALYSIS
# =============================================================
loo <- leave1out(ma_re)
loo

# =============================================================
# 13. INFLUENCE DIAGNOSTICS
# =============================================================
inf <- influence(ma_re)
inf
plot(inf)
